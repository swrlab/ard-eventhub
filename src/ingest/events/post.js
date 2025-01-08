/*

	ard-eventhub
	by SWR Audio Lab

*/

// load node utils
const { DateTime } = require('luxon')
const ULID = require('ulid')

// load eventhub utils
const { createNewTopic, processServices } = require('../../utils/events')
const logger = require('../../utils/logger')
const pubsub = require('../../utils/pubsub')
const response = require('../../utils/response')

// load config
const config = require('../../../config')
const eventDuplicationConfig = require('../../../config/event-duplication.json')

const source = 'ingest/events/post'
const DEFAULT_ZONE = 'Europe/Berlin'

// feature flags
const IS_COMMON_TOPIC_ENABLED = true

module.exports = async (req, res) => {
	try {
		// fetch inputs
		const { eventName } = req.params
		const start = DateTime.fromISO(req.body.start, { zone: DEFAULT_ZONE })
		const pluginMessages = []

		// check eventName consistency
		if (req.body?.event && req.body.event !== eventName) {
			return response.errors.mismatchingEventName(req, res)
		}

		// check offset for start event
		if (start.plus({ minutes: 2 }) < DateTime.now()) {
			return response.errors.expiredStartTime(req, res)
		}

		// insert name, creator and timestamp into object
		const message = {
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

		// add workaround for stations in migration phase
		for (const service of message.services) {
			// check if externalID is in duplication config
			if (eventDuplicationConfig[service.externalId]) {
				// clone service and add new externalId
				const newService = structuredClone(service)
				newService.externalId = eventDuplicationConfig[service.externalId]

				// add to services
				message.services.push(newService)

				logger.log({
					level: 'info',
					message: `duplicated event > ${eventName} > ${service.externalId}`,
					source,
					data: { body: req.body, service, newService },
				})
			}
		}

		// compile core hashes and pubsub names for every service
		message.services = await Promise.all(
			message.services.map((service) => processServices(service, req))
		)

		// generate unique Id from the institution id and a random ULID
		message.id = `${req.user.institutionId}-${ULID.ulid()}`

		// collect unknown topics from returning errors
		const newServices = []
		for await (const service of message.services) {
			// ignoring blocked services
			if (!service.blocked && service.topic?.name) {
				// try sending message
				const messageId = await pubsub.publishMessage(
					service.topic.name,
					message,
					attributes
				)

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
			// prepare common post
			const topicName = pubsub.buildId(
				eventName.replace('de.ard.eventhub.', '')
			)
			const commonEvent = {
				type: 'common',
				topic: {
					id: eventName,
					name: topicName,
				},
			}

			// try sending message
			commonEvent.messageId = await pubsub.publishMessage(
				topicName,
				message,
				attributes
			)

			// handle errors
			if (
				commonEvent.messageId === 'TOPIC_ERROR' ||
				commonEvent.messageId === 'TOPIC_NOT_FOUND'
			) {
				logger.log({
					level: 'warning',
					message: `failed common plugin > ${eventName} > ${message.services[0]?.publisherId}`,
					source,
					data: { message, body: req.body, commonEvent },
				})
			}

			// add to output
			pluginMessages.push(commonEvent)
		}

		// add opt-out plugins
		const isDtsPluginSet = message.plugins?.find(
			(plugin) => plugin.type === 'dts'
		)
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
					const messageId = await pubsub.publishMessage(
						config.pubSubTopicSelf,
						pluginMessage,
						attributes
					)

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
				published: message.services.filter(
					(service) => service.topic?.messageId
				).length,
				blocked: message.services.filter((service) => service.blocked).length,
				failed: message.services.filter(
					(service) => !service.topic?.messageId && !service.blocked
				).length,
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

		return response.internalServerError(req, res, error)
	}
}
