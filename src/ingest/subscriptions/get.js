/*

	ard-eventhub
	by SWR audio lab

*/

// load eventhub utils
const pubsub = require('../../utils/pubsub');
const response = require('../../utils/response');

module.exports = async (req, res) => {
	try {
		// preset vars
		const subscriptionName = req.params.subscriptionName;
		let subscription;

		// load single subscription
		try {
			subscription = await pubsub.getSubscription(subscriptionName);
		} catch (err) {
			return res.sendStatus(404);
		}

		// filter subscription by authenticated user
		if (!subscription.owner || subscription.owner !== req.user.email) {
			return res.sendStatus(404);
		}

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
		return response.internalServerError(req, res, err);
	}
};
