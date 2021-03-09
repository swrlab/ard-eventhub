/*

	ard-eventhub
	by SWR audio lab

*/

// Load packages
const slug = require('slug');

// load eventhub utils
const datastore = require('../../utils/datastore');
const pubsub = require('../../utils/pubsub');
const response = require('../../utils/response');

//TODO: check IDs in ARD Core-API instead of dump
const coreApi = require('../../data/coreApi.json');

module.exports = async (req, res) => {
	try {
		// use entire POST body to include potentially new fields
		let message = req.body;
		let user = req.user;

		// save message to datastore
		message = await datastore.save(message, 'events');
		message.id = message.id.toString();

		// get serviceIds from message
		let serviceIds = message.serviceIds;
		let unauthorizedServiceIds = [];

		// check allowed serviceIds for current user
		serviceIds.forEach((serviceId) => {
			if (user.serviceIds.indexOf(serviceId) == -1) {
				unauthorizedServiceIds.push(serviceId);
			}
		});

		// avoid usage of unauthorized serviceIds by user
		if (unauthorizedServiceIds.length > 0) {
			let err = `User '${user.email}' is not allowed to publish events for serviceIds: [${unauthorizedServiceIds}]`;
			console.error(err);
			return response.forbidden(req, res, err);
		}

		// generate pubsub IDs with prefix
		let pubSubIds = serviceIds.map((serviceId) => {
			return `${global.PREFIX}.publisher.${global.STAGE}.${serviceId}`;
		});

		// try to publish message under given topics
		let topics = await pubsub.publishMessage(pubSubIds, message);
		let unknownTopics = [];

		// collect unknown topics from returning errors
		Object.keys(topics).forEach((topic) => {
			if (topics[topic] == 'TOPIC_ERROR' || topics[topic] == 'TOPIC_NOT_FOUND') {
				let newTopic = {
					id: topic.split('.').pop(),
					pubsub: topic,
					name: undefined,
					label: undefined,
					verified: false,
					created: false,
				};
				unknownTopics.push(newTopic);
			}
		});

		// check unknown topic IDs
		if (unknownTopics.length > 0) {
			// verify IDs of unknownTopics with coreApi
			unknownTopics.forEach((topic) => {
				coreApi.forEach((entry) => {
					if (topic.id == entry.externalId) {
						topic.name = entry.title;
						topic.label = slug(entry.title);
						topic.verified = true;
					}
				});
			});

			// create topics for verified IDs
			await Promise.all(
				unknownTopics.map(async (topic) => {
					if (topic.verified) {
						let result = await pubsub.createTopic(topic);
						if (result && result.name && result.name.indexOf(topic.id) != -1) {
							topic.created = true;
							// Update api result that topic was created
							topics[topic.pubsub] = 'TOPIC_CREATED';
						} else {
							// Update api result that topic was not created
							topics[topic.pubsub] = 'TOPIC_NOT_CREATED';
						}
					}
				})
			);
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
		);
	} catch (err) {
		console.error(
			'ingest/events/post',
			'failed to publish event',
			JSON.stringify({
				body: req.body,
				headers: req.headers,
				error: err.stack || err,
			})
		);
		return response.internalServerError(req, res, err);
	}
};
