/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const slug = require('slug')
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

function getServiceId(pubSubId) {
	return pubSubId.split('.').pop()
}

module.exports = async (req, res) => {
	try {
		// use entire POST body to include potentially new fields
		let message = req.body
		const { eventName } = req.params
		const { user } = req

		// check eventName
		if (message.event && eventName !== message.event) {
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

		// compile core hashes for every service
		message.assets = await Promise.all(
			message.assets.map(async (service) => {
				// fetch prefix from configured list
				const urnPrefix = config.coreIdPrefixes[service.type]

				// create hash based on prefix and id
				service.id = `${urnPrefix}${core.createHashedId(service.externalId)}`

				// convert publisher if needed
				const urnRegex = /(?=urn:ard:publisher:[a-z0-9]{16})/g
				if (!service.publisherId.match(urnRegex)) {
					// fetch prefix
					const urnPublisherPrefix = config.coreIdPrefixes.Publisher

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

				// check allowed serviceIds for current user
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

				if (!service.blocked) service.topic = pubsub.buildId(service.id)

				// final data
				return service
			})
		)

		// save message to datastore
		message = await datastore.save(message, 'events')
		message.id = message.id.toString()
		delete message.creator

		// try to publish message using given topics
		//const topics = await pubsub.publishMessage(pubSubIds, message)
		const topics = []
		const unknownTopics = []

		// collect unknown topics from returning errors
		Object.keys(topics).forEach((topic) => {
			if (topics[topic] === 'TOPIC_ERROR' || topics[topic] === 'TOPIC_NOT_FOUND') {
				const newTopic = {
					id: getServiceId(topic),
					pubsub: topic,
					name: undefined,
					label: undefined,
					verified: false,
					created: false,
				}
				unknownTopics.push(newTopic)
			}
		})

		// check unknown topic IDs
		if (unknownTopics.length > 0) {
			// verify IDs of unknownTopics with coreApi
			unknownTopics.forEach((topic) => {
				coreApi.forEach((entry) => {
					if (topic.id === entry.externalId) {
						topic.name = entry.title
						topic.label = slug(entry.title)
						topic.verified = true
					}
				})
			})

			// create topics for verified IDs
			for await (const topic of unknownTopics) {
				if (topic.verified) {
					const [result] = await pubsub.createTopic(topic)

					if (result?.name?.indexOf(topic.id) !== -1) {
						topic.created = true
						// Update api result that topic was created
						topics[topic.pubsub] = 'TOPIC_CREATED'
					} else {
						// Update api result that topic was not created
						topics[topic.pubsub] = 'TOPIC_NOT_CREATED'
					}
				}
			}
		}

		// return ok
		return response.ok(
			req,
			res,
			{
				topics,
				event: message,
			},
			201
		)
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
