/*

	ard-eventhub
	by SWR audio lab

*/

const pubsub = require('../../utils/pubsub');

module.exports = async (req, res) => {
	try {
		// preset vars
		const subscriptionName = req.params.subscriptionName;

		// load single subscription
		let subscription = await pubsub.getSubscription(subscriptionName);

		// DEV filter subscription by authenticated user

		// return data
		res.status(200).json(subscription);
	} catch (err) {
		console.error(
			'ingest/subscriptions/get',
			'failed to get subscription',
			JSON.stringify({
				body: req.body,
				error: err.stack || err,
			})
		);
		return res.sendStatus(500);
	}
};
