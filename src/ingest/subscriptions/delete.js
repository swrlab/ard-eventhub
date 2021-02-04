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

		// load single subscription to get owner
		try {
			subscription = await pubsub.getSubscription(subscriptionName);
		} catch (err) {
			console.error(
				'ingest/subscription/delete',
				'failed to find topic to be deleted',
				JSON.stringify({
					subscriptionName,
					code: err.code,
					details: err.details,
					error: err.stack || err,
				})
			);

			if (err && err.code == 5) {
				// pubsub error code 5 seems to be 'Resource not found'
				return response.badRequest(req, res, {
					status: 404,
					message: 'Subscription not found',
				});
			}

			// return generic error
			return response.badRequest(req, res, {
				status: 500,
				message: 'Error while loading desired subscription',
			});
		}

		// DEV check permissions

		// request actual deletion
		let deletedSubscription = await pubsub.deleteSubscription(subscriptionName);

		// return data
		return response.ok(req, res, {
			valid: true,
		});
	} catch (err) {
		console.error(
			'ingest/subscriptions/delete',
			'failed to delete subscription',
			JSON.stringify({
				body: req.body,
				error: err.stack || err,
			})
		);
		return response.internalServerError(req, res, err);
	}
};
