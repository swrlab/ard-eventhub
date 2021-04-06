/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const moment = require('moment')

// load eventhub utils
const core = require('../../utils/core')
const datastore = require('../../utils/datastore')
const logger = require('../../utils/logger')
const pubsub = require('../../utils/pubsub')
const response = require('../../utils/response')

// load config
const config = require('../../../config')

const source = 'ingest/events/post'

module.exports = async (req, res) => {
	try {
		// use entire POST body to include potentially new fields
		let message = req.body
		const { eventName } = req.params
		const { user } = req

		// check eventName
		if (message?.event !== eventName) {
			// log access attempt
			logger.log({
				level: 'warning',
				message: 'User attempted event with missmatching names',
				source,
				data: {
					email: req.user.email,
					body: message.event,
					params: eventName,
				},
			})

			// return 400
			return response.badRequest(req, res, {
				message: 'request.body.event should match URL parameter',
				errors: [
					{
						path: '.body.event',
						message: 'should match URL parameter',
						errorCode: 'required.openapi.validation',
					},
				],
			})
		}

		// check offset for start event
		if (moment(message.start).add(2, 'm').isBefore()) {
			// log access attempt
			logger.log({
				level: 'notice',
				message: `User attempted event with expired start time ${message.start}`,
				source,
				data: {
					email: req.user.email,
					message,
				},
			})

			// return 400
			return response.badRequest(req, res, {
				message: 'request.body.start should be recent',
				errors: [
					{
						path: '.body.start',
						message: 'should not be expired event',
						errorCode: 'required.openapi.validation',
					},
				],
			})
		}

		// insert name, creator and timestamp into object
		message = {
			name: eventName,
			creator: user.email,
			created: moment().toISOString(),
			...message,
		}

		// use collector to check duplicates for externalId in services
		const externalIdCollector = []

		// compile core hashes for every service
		message.services = await Promise.all(
			message.services.map(async (service) => {
				// check for duplicates
				if (externalIdCollector.includes(service.externalId)) service.blocked = true
				externalIdCollector.push(service.externalId)

				// fetch prefix from configured list
				const urnPrefix = config.coreIdPrefixes[service.type]

				// create hash based on prefix and id
				service.topic = { id: `${urnPrefix}${core.createHashedId(service.externalId)}` }

				// convert publisher if needed
				const urnRegex = /(?=urn:ard:publisher:[a-z0-9]{16})/g
				if (!service.publisherId.match(urnRegex)) {
					// fetch prefix
					const urnPublisherPrefix = config.coreIdPrefixes.Publisher

					// add trailing 0 if number is only 5 digits
					if (service.publisherId.length === 5)
						service.publisherId = `${service.publisherId}0`

					// create hash using given publisherId
					service.publisherId = `${urnPublisherPrefix}${core.createHashedId(
						service.publisherId
					)}`
				}

				// fetch publisher
				const publisher = await core.getPublisher(service.publisherId)

				// block access if publisher not found
				if (!service.blocked && !publisher) {
					// set blocked flag to be filtered out
					service.blocked = true

					// log access attempt
					logger.log({
						level: 'warning',
						message: `Publisher not found > ${service.publisherId}`,
						source,
						data: {
							email: req.user.email,
							service,
						},
					})
				}

				// check allowed institutions for current user
				if (!service.blocked && user.institutionId !== publisher?.institution?.id) {
					// set blocked flag to be filtered out
					service.blocked = true

					// log access attempt
					logger.log({
						level: 'warning',
						message: 'User unauthorized for service',
						source,
						data: {
							email: req.user.email,
							service,
							user: user.institution,
							publisher: publisher?.institution,
						},
					})
				}

				// create pub/sub-compliant name
				if (!service.blocked) service.topic.name = pubsub.buildId(service.topic.id)

				// final data
				return service
			})
		)

		// save message to datastore
		message = await datastore.save(message, 'events')
		message.id = message.id.toString()
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
						creator: user.email,

						coreId: service.topic.id,
						externalId: service.externalId,
						name: service.topic.name,

						institution: {
							id: user.institutionId,
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
						// Update api result that topic was created
						service.topic.status = 'TOPIC_CREATED'

						logger.log({
							level: 'notice',
							message: `topic created > ${service.topic.name}`,
							source,
							data: { service, result },
						})
					} else {
						// Update api result that topic was not created
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

		// prepare output data
		const data = {
			statuses: {
				published: message.services.filter((service) => service.topic?.messageId).length,
				blocked: message.services.filter((service) => service.blocked).length,
				failed: message.services.filter(
					(service) => !service.topic?.messageId && !service.blocked
				).length,
			},
			event: message,
		}

		// log success
		logger.log({
			level: 'notice',
			message: `event processed > ${eventName}`,
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
