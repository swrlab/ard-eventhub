/*

	ard-eventhub
	by SWR Audio Lab

*/

// load node utils
const moment = require('moment')
const { createHashedId } = require('@swrlab/utils/packages/ard')

// load eventhub utils
const core = require('../../utils/core')
const datastore = require('../../utils/datastore')
const logger = require('../../utils/logger')
const pubsub = require('../../utils/pubsub')
const response = require('../../utils/response')

// load config
const config = require('../../../config')

const source = 'ingest/events/post'
const urnPublisherRegex = /(?=urn:ard:publisher:[a-z0-9]{16})/g

const processServices = async (service, req) => {
	// fetch prefix from configured list
	const urnPrefix = config.coreIdPrefixes[service.type]
	const topicId = `${urnPrefix}${createHashedId(service.externalId)}`

	// create hash based on prefix and id
	service.topic = {
		id: topicId,

		// create pub/sub-compliant name
		name: pubsub.buildId(service.topic.id),
	}

	// convert publisher if not in new urn format
	if (!service.publisherId.match(urnPublisherRegex)) {
		// fetch prefix
		const urnPublisherPrefix = config.coreIdPrefixes.Publisher

		// add trailing 0 if number is only 5 digits
		if (service.publisherId.length === 5) service.publisherId = `${service.publisherId}0`

		// create hash using given publisherId
		service.publisherId = `${urnPublisherPrefix}${createHashedId(service.publisherId)}`
	}

	// fetch publisher
	const publisher = await core.getPublisher(service.publisherId)

	// block access if publisher not found
	if (!publisher) {
		// set blocked flag to be filtered out
		service.blocked = `Publisher not found > ${service.publisherId}`

		// log access attempt
		logger.log({
			level: 'warning',
			message: service.blocked,
			source,
			data: { service, user: req.user },
		})

		// stop processing
		return service
	}

	// check allowed institutions for current user
	if (req.user.institutionId !== publisher?.institution?.id) {
		// set blocked flag to be filtered out
		service.blocked = 'User unauthorized for service'

		// log access attempt
		logger.log({
			level: 'warning',
			message: service.blocked,
			source,
			data: { service, user: req.user, publisher: publisher?.institution },
		})

		// stop processing
		return service
	}

	// final data
	return service
}

module.exports = async (req, res) => {
	try {
		// fetch inputs
		const { eventName } = req.params

		// check eventName
		if (req.body?.event && req.body.event !== eventName) {
			return response.errors.mismatchingEventName(req, res, eventName)
		}

		// check offset for start event
		if (moment(req.body.start).add(2, 'm').isBefore()) {
			return response.errors.expiredStartTime(req, res)
		}

		// DEV check for duplicates

		// insert name, creator and timestamp into object
		const message = {
			name: eventName,
			creator: req.user.email,
			created: moment().toISOString(),

			// use entire POST body to include potentially new fields
			...req.body,
		}

		// compile core hashes for every service
		message.services = await Promise.all(message.services.map((service) => processServices(service, req)))

		// save message to datastore
		const savedMessage = await datastore.save(message, 'events')
		message.id = savedMessage.id.toString()
		delete message.creator

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
					// fetch publisher
					const publisher = await core.getPublisher(service.publisherId)

					// try creating new topic
					const newTopic = {
						created: moment().toISOString(),
						creator: req.user.email,

						coreId: service.topic.id,
						externalId: service.externalId,
						name: service.topic.name,

						institution: {
							id: req.user.institutionId,
							title: publisher.institution.title,
						},

						publisher: {
							id: service.publisherId,
							title: publisher.title,
						},
					}

					// save topic to datastore
					await datastore.save(newTopic, 'topics')
					newTopic.id = newTopic.id.toString()

					// create topic
					const [result] = await pubsub.createTopic(newTopic)

					// handle feedback
					if (result?.name?.indexOf(service.topic.name) !== -1) {
						// update api result that topic was created
						service.topic.status = 'TOPIC_CREATED'

						logger.log({
							level: 'notice',
							message: `topic created > ${service.topic.name}`,
							source,
							data: { service, result },
						})
					} else {
						// update api result that topic was not created
						service.topic.status = 'TOPIC_NOT_CREATED'

						logger.log({
							level: 'error',
							message: `failed creating topic > ${service.topic.name}`,
							source,
							data: { service, result },
						})
					}

					// insert empty id
					service.topic.messageId = null
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
			message: `event processed > ${eventName} (${message.services[0]?.publisherId})`,
			source,
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
