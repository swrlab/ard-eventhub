/*

	ard-eventhub
	by SWR Audio Lab

*/

// load node utils
const { DateTime } = require('luxon')

// load eventhub utils
const datastore = require('../../utils/datastore')
const { createNewTopic, processServices } = require('../../utils/events')
const logger = require('../../utils/logger')
const pubsub = require('../../utils/pubsub')
const response = require('../../utils/response')

// load config
const config = require('../../../config')

const source = 'ingest/events/post'

module.exports = async (req, res) => {
	try {
		// fetch inputs
		const { eventName } = req.params

		// check eventName consistency
		if (req.body?.event && req.body.event !== eventName) {
			return response.errors.mismatchingEventName(req, res)
		}

		// check offset for start event
		if (DateTime.fromISO(req.body.start).plus({ minutes: 2 }) < DateTime.now()) {
			return response.errors.expiredStartTime(req, res)
		}

		// DEV check for duplicates

		// insert name, creator and timestamp into object
		const message = {
			name: eventName,
			creator: req.user.email,
			created: DateTime.now().toISO(),

			// use entire POST body to include potentially new fields
			...req.body,
		}

		// compile core hashes and pubsub names for every service
		message.services = await Promise.all(message.services.map((service) => processServices(service, req)))

		// save message to datastore
		const savedMessage = await datastore.save(message, 'events')
		message.id = savedMessage.id.toString()

		// collect unknown topics from returning errors
		const newServices = []
		for await (const service of message.services) {
			// ignoring blocked services
			if (!service.blocked && service.topic?.name) {
				// try sending message
				const messageId = await pubsub.publishMessage(service.topic.name, message)

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

		// handle plugin integrations
		const pluginMessages = []
		if (message?.plugins?.length > 0) {
			for await (const plugin of message.plugins) {
				const pluginMessage = {
					action: `plugins.${plugin.type}.event`,
					event: message,
					plugin,
					institutionId: req.user.institutionId,
				}

				// try sending message
				const messageId = await pubsub.publishMessage(config.pubSubTopicSelf, pluginMessage)

				// add to output
				pluginMessages.push({
					type: plugin.type,
					messageId,
				})
			}
		}

		// prepare output data
		const data = {
			statuses: {
				published: message.services.filter((service) => service.topic?.messageId).length,
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
			level: 'notice',
			message: `event processed > ${eventName} > ${message.services.length}x services (${message.services[0]?.publisherId})`,
			source: `${source}/${eventName}`,
			data,
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
