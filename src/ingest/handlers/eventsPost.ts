/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Context } from 'hono'
import { DateTime } from 'luxon'
import { ulid } from 'ulid'

import type { AppVariables } from '@/src/ingest/types.ts'
import { toLegacyRequest } from '@/src/ingest/legacyRequest.ts'
import type { EventhubPluginMessage, EventhubV1RadioPostBody } from '@/types.eventhub.ts'
import config from '@/config/index.ts'
import createNewTopic from '@/src/utils/events/createNewTopic.ts'
import processServices from '@/src/utils/events/processServices.ts'
import pubsubBuildId from '@/src/utils/pubsub/buildId.ts'
import publishPubSubMessage from '@/src/utils/pubsub/publishMessage.ts'
import responseOk from '@/src/utils/response/ok.ts'
import responseBadRequest from '@/src/utils/response/badRequest.ts'
import responseInternalServerError from '@/src/utils/response/internalServerError.ts'
import errorsMismatchingEventName from '@/src/utils/response/errors/mismatchingEventName.ts'
import errorsExpiredStartTime from '@/src/utils/response/errors/expiredStartTime.ts'

const source = 'ingest/events/post'
const DEFAULT_ZONE = 'Europe/Berlin'
const IS_COMMON_TOPIC_ENABLED = true
const MAX_OFFSET_IN_MINUTES = 15

export default async (c: Context<{ Variables: AppVariables }>, body: Record<string, unknown>) => {
	try {
		const user = c.get('user')

		if (!user) {
			logger.log({
				level: 'notice',
				message: 'user not found',
				source,
				data: { ...Object.fromEntries(c.req.raw.headers), authorization: 'hidden' },
			})
			return responseInternalServerError(c, new Error('User not found'))
		}

		const eventName = c.req.param('eventName')
		const start = DateTime.fromISO(String(body.start), {
			zone: DEFAULT_ZONE,
		})
		const pluginMessages = []

		if (!eventName) {
			return responseBadRequest(c, {
				status: 400,
				message: 'Event name not found',
			})
		}

		if (body?.event && body.event !== eventName) {
			return errorsMismatchingEventName(c, body)
		}

		if (start.plus({ minutes: MAX_OFFSET_IN_MINUTES }) < DateTime.now()) {
			return errorsExpiredStartTime(c, body)
		}

		const message: EventhubV1RadioPostBody = {
			name: eventName,
			creator: user.email,
			created: DateTime.now().toLocal().toISO(),
			plugins: [],
			...structuredClone(body),
			start: start.toLocal().toISO(),
		}

		const attributes = { event: eventName }
		const legacyRequest = toLegacyRequest(c, body)
		message.services = await Promise.all(message.services.map((service) => processServices(service, legacyRequest)))
		message.id = `${user.institutionId}-${ulid()}`

		const newServices = []
		for await (const service of message.services) {
			if (!service.blocked && service.topic?.name) {
				const messageId = await publishPubSubMessage(service.topic.name, message, attributes)

				if (messageId === 'TOPIC_ERROR') {
					service.topic.status = 'TOPIC_ERROR'
					service.topic.messageId = null
				} else if (messageId === 'TOPIC_NOT_FOUND') {
					service.topic = await createNewTopic(service, legacyRequest)
				} else {
					service.topic.status = 'MESSAGE_SENT'
					service.topic.messageId = messageId
				}
			}

			newServices.push(service)
		}

		message.services = newServices
		const nonBlockedServices = message.services.filter((service) => !service.blocked)

		if (IS_COMMON_TOPIC_ENABLED && body.event !== 'de.ard.eventhub.v1.radio.text') {
			if (nonBlockedServices.length > 0) {
				const topicName = pubsubBuildId(eventName.replace('de.ard.eventhub.', ''))
				const commonEvent = {
					messageId: null as null | string,
					type: 'common',
					topic: {
						id: eventName,
						name: topicName,
					},
				}

				const filteredMessage = {
					...message,
					services: nonBlockedServices,
				}

				commonEvent.messageId = await publishPubSubMessage(topicName, filteredMessage, attributes)

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

				pluginMessages.push(commonEvent)
			}
		}

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

		if (message.plugins?.length > 0) {
			for await (const plugin of message.plugins) {
				if (!plugin.isDeactivated) {
					const pluginMessage: EventhubPluginMessage = {
						action: `plugins.${plugin.type}.event`,
						event: { ...message, services: nonBlockedServices },
						plugin,
						institutionId: user.institutionId,
					}

					const messageId = await publishPubSubMessage(config.pubSubTopicSelf, pluginMessage, attributes)

					pluginMessages.push({
						type: plugin.type,
						messageId,
					})
				}
			}
		}

		const data = {
			statuses: {
				published: message.services.filter((service) => service.topic?.messageId).length,
				blocked: message.services.filter((service) => service.blocked).length,
				failed: message.services.filter((service) => !service.topic?.messageId && !service.blocked).length,
			},
			plugins: pluginMessages,
			event: message,
		}

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
