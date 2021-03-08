/*

	ard-eventhub
	by SWR audio lab

*/

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

		// save message to datastore
		message = await datastore.save(message, 'events');
		message.id = message.id.toString();

		// get serviceIds from message
		let serviceIds = message.serviceIds.map((serviceId) => {
			let prefix = 'de.ard.eventhub.publisher';
			let stage = global.STAGE.toLowerCase();
			return prefix + '.' + stage + '.' + serviceId;
		});

		// try to publish message under given topics
		let topics = await pubsub.publishMessage(serviceIds, message);
		let unknownTopics = [];

		// collect unknown topics from returning errors
		Object.keys(topics).forEach((topic) => {
			if (topics[topic] == 'TOPIC_ERROR' || topics[topic] == 'TOPIC_NOT_FOUND') {
				let newTopic = {
					id: topic,
					name: undefined,
					label: undefined,
					verified: false,
					created: false,
				};
				unknownTopics.push(newTopic);
			}
		});

		// check unknown topic ids
		if (unknownTopics.length > 0) {
			// find IDs of unknownTopics in coreApi dump
			unknownTopics.forEach((topic) => {
				coreApi.forEach((entry) => {
					//TODO: store id with and without prefix
					if (topic.id == entry.externalId) {
						topic.name = entry.title;
						topic.label = entry.title
							.toLowerCase()
							.replace(' ', '_')
							.replace('ä', 'ae')
							.replace('ü', 'ue')
							.replace('ö', 'oe')
							.replace('ß', 'ss');
						topic.verified = true;
					}
				});
			});

			unknownTopics.map(async (topic) => {
				if (topic.verified) {
					let result = await pubsub.createTopic(topic);
					if (result) {
						unknownTopics[topic].created = true;
						//TODO: how to handle the result?
					}
				}
			});
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
