/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const slug = require('slug')

// load eventhub utils
const datastore = require('../../utils/datastore')
const pubsub = require('../../utils/pubsub')
const response = require('../../utils/response')
const config = require('../../../config')

// TODO: check IDs in ARD Core-API instead of dump
const coreApi = require('../../data/coreApi.json')

// define functions
function getPubSubId(serviceId) {
	const pubIdent = 'publisher'
	return `${config.pubsubPrefix}.${pubIdent}.${config.stage}.${serviceId}`
}

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
		if (eventName !== message.event) {
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

		// save message to datastore
		message = await datastore.save(message, 'events')
		message.id = message.id.toString()

		// get serviceIds from message
		const { serviceIds } = message
		const unauthorizedServiceIds = []

		// check allowed serviceIds for current user
		serviceIds.forEach((serviceId) => {
			if (user.serviceIds.indexOf(serviceId) === -1) {
				// add forbidden ids to unauthorized array
				unauthorizedServiceIds.push(serviceId)

				// remove forbidden ids from serviceId array
				serviceIds.splice(serviceIds.indexOf(serviceId), 1)
			}
		})

		// generate pubsub IDs with prefix
		const pubSubIds = serviceIds.map((serviceId) => {
			return getPubSubId(serviceId)
		})

		// try to publish message under given topics
		const topics = await pubsub.publishMessage(pubSubIds, message)
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

		console.log({serviceIds, pubSubIds});

		// check unknown topic IDs
		if (unknownTopics.length > 0) {
			// verify IDs of unknownTopics with coreApi
			unknownTopics.forEach((topic) => {
				coreApi.forEach((entry) => {
					if (topic.id === entry.externalId) {
						console.log({topic});
						topic.name = entry.title
						topic.label = slug(entry.title)
						topic.verified = true
					}
				})
			})

			// create topics for verified IDs
			await Promise.all(
				unknownTopics.map(async (topic) => {
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
				})
			)
		}

		// check forbidden serviceIds
		if (unauthorizedServiceIds.length > 0) {
			console.error(
				`User '${user.email}' is not allowed to publish events for serviceIds: [${unauthorizedServiceIds}]`
			)
			unauthorizedServiceIds.forEach((unauthorizedServiceId) => {
				const pubSubId = getPubSubId(unauthorizedServiceId)
				topics[pubSubId] = 'TOPIC_NOT_ALLOWED'
			})
		}

		// return ok
		return response.ok(
			req,
			res,
			{
				topics,
				message,
				debug: {
					body: req.body,
					headers: req.headers,
				},
			},
			201
		)
	} catch (err) {
		console.error(
			'ingest/events/post',
			'failed to publish event',
			JSON.stringify({
				body: req.body,
				headers: req.headers,
				error: err.stack || err,
			})
		)
		return response.internalServerError(req, res, err)
	}
}
