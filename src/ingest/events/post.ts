import type { Context } from 'hono'
import type {
	AppVariables,
	AuthUser,
	EventhubPluginMessage,
	EventhubV1RadioPostBody,
	EventRequestContext,
} from '#types'
import { DateTime } from '@frytg/dates'
import logger from '@frytg/logger'
import { ulid } from 'ulid'
import { pubSubTopicSelf } from '#config'
import { createNewTopic } from '../../utils/events/create-new-topic.ts'
import { processServices } from '../../utils/events/process-services.ts'
import { pubsubBuildId } from '../../utils/pubsub/build-id.ts'
import { publishPubSubMessage } from '../../utils/pubsub/publish-message.ts'
import { badRequest as responseBadRequest } from '../../utils/response/bad-request.ts'
import { errorsExpiredStartTime } from '../../utils/response/errors/expired-start-time.ts'
import { errorsMismatchingEventName } from '../../utils/response/errors/mismatching-event-name.ts'
import { responseInternalServerError } from '../../utils/response/internal-server-error.ts'
import { responseOk } from '../../utils/response/ok.ts'
import { getValidatedBody } from '../../utils/validation/zod-validate.ts'

const source = 'ingest/events/post'
const DEFAULT_ZONE = 'Europe/Berlin'

// feature flags
const IS_COMMON_TOPIC_ENABLED = true
const MAX_OFFSET_IN_MINUTES = 15

/**
 * Build a request context for event helpers from the Hono context.
 * @param c - Hono context
 * @param body - Validated event body
 * @returns Event request context
 */
const toEventRequestContext = (
	c: Context<{ Variables: AppVariables }>,
	body: Record<string, unknown>
): EventRequestContext => ({
	user: c.get('user'),
	body,
	headers: Object.fromEntries(c.req.raw.headers),
})

/**
 * Distribute a radio track or text event to subscribers.
 * @param c - Hono context
 * @returns Event publish response
 */
export const eventsPost = async (c: Context<{ Variables: AppVariables }>) => {
	const body = getValidatedBody<Record<string, unknown>>(c)
	try {
		const user = c.get('user') as AuthUser | undefined
		if (!user) {
			logger.log({
				level: 'notice',
				message: 'user not found',
				source,
				data: {
					...Object.fromEntries(c.req.raw.headers),
					authorization: 'hidden',
				},
			})
			return responseInternalServerError(c, new Error('User not found'))
		}

		// fetch inputs
		const eventNameParam = c.req.param('eventName')
		// check if event name is present
		if (!eventNameParam) {
			return responseBadRequest(c, {
				status: 400,
				message: 'Event name not found',
			})
		}

		const eventName = eventNameParam

		const start = DateTime.fromISO(String(body.start), {
			zone: DEFAULT_ZONE,
		})
		const pluginMessages = []
		const req = toEventRequestContext(c, body)

		// check eventName consistency
		if (body?.event && body.event !== eventName) {
			return errorsMismatchingEventName(c, body)
		}

		// check offset for start event
		if (start.plus({ minutes: MAX_OFFSET_IN_MINUTES }) < DateTime.now()) {
			return errorsExpiredStartTime(c, body)
		}

		// insert name, creator and timestamp into object
		const message = {
			name: eventName,
			creator: user.email as string,
			created: DateTime.now().toLocal().toISO(),
			plugins: [] as EventhubV1RadioPostBody['plugins'],

			// use entire POST body to include potentially new fields
			...structuredClone(body),

			// reformat start time
			start: start.toLocal().toISO() as string,
		} as unknown as EventhubV1RadioPostBody

		// create custom attributes for pubsub metadata
		const attributes = { event: eventName }

		// compile core hashes and pubsub names for every service
		message.services = await Promise.all(message.services.map((service) => processServices(service, req)))

		// generate unique Id from the institution id and a random ULID
		message.id = `${user.institutionId}-${ulid()}`

		// collect unknown topics from returning errors
		const newServices = []
		for await (const service of message.services) {
			// ignoring blocked services
			if (!service.blocked && service.topic?.name) {
				// try sending message
				const messageId = await publishPubSubMessage(service.topic.name, message, attributes)

				// handle errors
				if (messageId === 'TOPIC_ERROR') {
					// insert error message and empty id
					service.topic.status = 'TOPIC_ERROR'
					service.topic.messageId = null
				} else if (messageId === 'TOPIC_NOT_FOUND') {
					// first message, create a new topic
					service.topic = await createNewTopic(service, req)
				} else {
					// insert messageId
					service.topic.status = 'MESSAGE_SENT'
					service.topic.messageId = messageId
				}
			}

			// send to new array
			newServices.push(service)
		}

		// replace services
		message.services = newServices

		// filter out blocked services before sending to common topic
		const nonBlockedServices = message.services.filter((service) => !service.blocked)

		// send event to common topic
		// if it is not a radio text event
		if (IS_COMMON_TOPIC_ENABLED && body.event !== 'de.ard.eventhub.v1.radio.text') {
			// only send to common topic if there are non-blocked services
			if (nonBlockedServices.length > 0) {
				// prepare common post
				const topicName = pubsubBuildId(eventName.replace('de.ard.eventhub.', ''))
				const commonEvent = {
					messageId: null as null | string,
					type: 'common',
					topic: {
						id: eventName,
						name: topicName,
					},
				}

				// create filtered message with only non-blocked services
				const filteredMessage = {
					...message,
					services: nonBlockedServices,
				}

				// try sending message
				commonEvent.messageId = await publishPubSubMessage(topicName, filteredMessage, attributes)

				// handle errors
				if (commonEvent.messageId === 'TOPIC_ERROR' || commonEvent.messageId === 'TOPIC_NOT_FOUND') {
					logger.log({
						level: 'warning',
						message: `failed common plugin > ${eventName} > ${nonBlockedServices[0]?.publisherId}`,
						source,
						data: {
							message: filteredMessage,
							body,
							commonEvent,
						},
					})
				}

				// add to output
				pluginMessages.push(commonEvent)
			}
		}

		// add opt-out plugins
		const isDtsPluginSet = message.plugins?.find((plugin) => plugin.type === 'dts')
		const isRadioplayerPluginSet = message.plugins?.find((plugin) => plugin.type === 'radioplayer')
		const isMusic = body.type === 'music'
		const isNowPlayingEvent = message.name === 'de.ard.eventhub.v1.radio.track.playing'

		if (!isDtsPluginSet && isMusic && isNowPlayingEvent) {
			message.plugins.push({
				type: 'dts',
				isDeactivated: false,
				note: 'automatically enabled by opt-out',
			})
		}

		if (!isRadioplayerPluginSet && isMusic && isNowPlayingEvent) {
			message.plugins.push({
				type: 'radioplayer',
				isDeactivated: false,
				note: 'automatically enabled by opt-out',
			})
		}

		// handle plugin integrations
		if (message.plugins?.length > 0) {
			for await (const plugin of message.plugins) {
				if (!plugin.isDeactivated) {
					const pluginMessage: EventhubPluginMessage = {
						action: `plugins.${plugin.type}.event`,
						event: { ...message, services: nonBlockedServices },
						plugin,
						institutionId: user.institutionId as string,
					}

					// try sending message
					const messageId = await publishPubSubMessage(pubSubTopicSelf, pluginMessage, attributes)

					// add to output
					pluginMessages.push({
						type: plugin.type,
						messageId,
					})
				}
			}
		}

		// prepare output data
		const data = {
			statuses: {
				published: message.services.filter((service) => service.topic?.messageId).length,
				blocked: message.services.filter((service) => service.blocked).length,
				failed: message.services.filter((service) => !(service.topic?.messageId || service.blocked)).length,
			},
			plugins: pluginMessages,
			event: message,
		}

		// log success
		logger.log({
			level: data.statuses.blocked > 0 ? 'warning' : 'info',
			message: `event processed > ${eventName} > ${message.services.length}x services (${message.services[0]?.publisherId})`,
			source,
			data: { ...data, body, isDtsPluginSet, isRadioplayerPluginSet },
		})

		return responseOk(c, data, 201)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to publish event',
			source,
			error,
			data: { body, headers: Object.fromEntries(c.req.raw.headers) },
		})

		return responseInternalServerError(c, error as Error)
	}
}
