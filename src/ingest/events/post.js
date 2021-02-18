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
		// DEV do more case-secific checks here

		// use entire POST body to include potentially new fields
		let message = req.body;

		// save message to datastore
		message = await datastore.save(message, 'events');
		message.id = message.id.toString();

		// DEV this is a very random topic test
		let topics = await pubsub.publishMessage(['demo'], message);

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
