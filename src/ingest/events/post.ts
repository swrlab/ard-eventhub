/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Response } from 'express'
import { DateTime } from 'luxon'
import { ulid } from 'ulid'

import type { EventhubV1RadioPostBody } from '@/types.eventhub.ts'
import config from '../../../config/index.ts'
import { createNewTopic, processServices } from '../../utils/events/index.ts'
import pubsub from '../../utils/pubsub/index.ts'
import publishPubSubMessage from '../../utils/pubsub/publishMessage.ts'
import response from '../../utils/response/index.ts'
import type UserTokenRequest from '../auth/middleware/userTokenRequest.ts'

const source = 'ingest/events/post'
const DEFAULT_ZONE = 'Europe/Berlin'

// feature flags
const IS_COMMON_TOPIC_ENABLED = true
const MAX_OFFSET_IN_MINUTES = 15

export default async (req: UserTokenRequest, res: Response) => {
	try {
		if (!req.user) {
			logger.log({
				level: 'notice',
				message: 'user not found',
				source,
				data: { ...req.headers, authorization: 'hidden' },
			})
			return response.internalServerError(req, res, new Error('User not found'))
		}

		// fetch inputs
		const { eventName } = req.params
		const start = DateTime.fromISO(req.body.start, {
			zone: DEFAULT_ZONE,
		})
		const pluginMessages = []

		// check if event name is present
		if (!eventName) {
			return response.badRequest(req, res, {
				status: 400,
				message: 'Event name not found',
			})
		}

		// check eventName consistency
		if (req.body?.event && req.body.event !== eventName) {
			return response.errors.mismatchingEventName(req, res)
		}

		// check offset for start event
		if (start.plus({ minutes: MAX_OFFSET_IN_MINUTES }) < DateTime.now()) {
			return response.errors.expiredStartTime(req, res)
		}

		// insert name, creator and timestamp into object
		const message: EventhubV1RadioPostBody = {
			name: eventName,
			creator: req.user.email,
			created: DateTime.now().toLocal().toISO(),
			plugins: [],

			// use entire POST body to include potentially new fields
			...structuredClone(req.body),

			// reformat start time
			start: start.toLocal().toISO(),
		}

		// create custom attributes for pubsub metadata
		const attributes = { event: eventName }

		// compile core hashes and pubsub names for every service
		message.services = await Promise.all(message.services.map((service) => processServices(service, req)))

		// generate unique Id from the institution id and a random ULID
		message.id = `${req.user.institutionId}-${ulid()}`

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

		// send event to common topic
		// if it is not a radio text event
		if (IS_COMMON_TOPIC_ENABLED && req.body.event !== 'de.ard.eventhub.v1.radio.text') {
			// filter out blocked services for common topic
			const nonBlockedServices = message.services.filter((service) => !service.blocked)

			// only send to common if there are non-blocked services
			if (nonBlockedServices.length > 0) {
				// prepare common post
				const topicName = pubsub.buildId(eventName.replace('de.ard.eventhub.', ''))
				const commonEvent = {
					messageId: null as null | string,
					type: 'common',
					topic: {
						id: eventName,
						name: topicName,
					},
				}

				// create message with only non-blocked services
				const commonMessage = {
					...message,
					services: nonBlockedServices,
				}

				// try sending message
				commonEvent.messageId = await publishPubSubMessage(topicName, commonMessage, attributes)

				// handle errors
				if (commonEvent.messageId === 'TOPIC_ERROR' || commonEvent.messageId === 'TOPIC_NOT_FOUND') {
					logger.log({
						level: 'warning',
						message: `failed common plugin > ${eventName} > ${nonBlockedServices[0]?.publisherId || 'unknown'}`,
						source,
						data: {
							message: commonMessage,
							body: req.body,
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
		const isMusic = req.body.type === 'music'

		if (!isDtsPluginSet && isMusic) {
			message.plugins.push({
				type: 'dts',
				isDeactivated: false,
				note: 'automatically enabled by opt-out',
			})
		}

		// handle plugin integrations
		if (message.plugins?.length > 0) {
			for await (const plugin of message.plugins) {
				if (!plugin.isDeactivated) {
					const pluginMessage = {
						action: `plugins.${plugin.type}.event`,
						event: message,
						plugin,
						institutionId: req.user.institutionId,
					}

					// try sending message
					const messageId = await publishPubSubMessage(config.pubSubTopicSelf, pluginMessage, attributes)

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
				failed: message.services.filter((service) => !service.topic?.messageId && !service.blocked).length,
			},
			plugins: pluginMessages,
			event: message,
		}

		// log success
		logger.log({
			level: 'info',
			message: `event processed > ${eventName} > ${message.services.length}x services (${message.services[0]?.publisherId})`,
			source,
			data: { ...data, body: req.body, isDtsPluginSet },
		})

		// return ok
		return response.ok(req, res, data, 201)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to publish event',
			source,
			error,
			data: { body: req.body, headers: req.headers },
		})

		return response.internalServerError(req, res, error as Error)
	}
}
