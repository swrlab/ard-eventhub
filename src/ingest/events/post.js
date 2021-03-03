/*

	ard-eventhub
	by SWR audio lab

*/

// load eventhub utils
const datastore = require('../../utils/datastore');
const pubsub = require('../../utils/pubsub');
const response = require('../../utils/response');

module.exports = async (req, res) => {
	try {
		// DEV do more case-specific checks here

		// use entire POST body to include potentially new fields
		let message = req.body;

		// save message to datastore
		message = await datastore.save(message, 'events');
		message.id = message.id.toString();

		// get serviceIds from message
		let serviceIds = message.serviceIds;

		// let topics = await pubsub.publishMessage(['demo'], message);
		let topics = await pubsub.publishMessage(serviceIds, message);
		let unknownTopics = [];

		// collect unknown topics
		Object.keys(topics).map((i) => {
			if (topics[i] == 'TOPIC_ERROR') {
				let topic = {
					id: i,
					name: undefined,
					verified: false,
					created: false,
				};
				unknownTopics.push(topic);
			}
		});

		// check unknown topic ids
		if (unknownTopics.length > 0) {
			//TODO: check IDs in ARD Core-API
			// if (result && result.name) {
			// 	unknownTopics[i].name = result.name;
			// 	unknownTopics[i].verified = true;
			// }

			unknownTopics.map(async (i) => {
				let result = await pubsub.createTopic(i);
				if (result) {
					unknownTopics[i].created = true;
					//TODO: how to handle the result?
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
