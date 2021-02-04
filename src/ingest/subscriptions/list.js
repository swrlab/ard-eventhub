/*

	ard-eventhub
	by SWR audio lab

*/

// load eventhub utils
const pubsub = require('../../utils/pubsub');
const response = require('../../utils/response');

module.exports = async (req, res) => {
	try {
		// load all subscriptions
		let subscriptions = await pubsub.getSubscriptions();

		// DEV filter subscriptions by authenticated user

		// return data
		res.status(200).json(subscriptions);
	} catch (err) {
		console.error(
			'ingest/subscriptions/list',
			'failed to list subscriptions',
			JSON.stringify({
				body: req.body,
				error: err.stack || err,
			})
		);
		return response.internalServerError(req, res, err);
	}
};
