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

		// check subscription permission by user organization
		if (subscription.organization?.id !== req.user.organization?.id) {
			let subsOrg = subscription.organization?.name;
			let userOrg = req.user.organization?.name;
			// return 400 error
			return response.badRequest(req, res, {
				status: 400,
				message: `Mismatch of user and subscription organization`,
				errors: `Subscription of organization '${subsOrg}' cannot be deleted by user of organization '${userOrg}'`,
			});
		}

		// request actual deletion
		await pubsub.deleteSubscription(subscriptionName);

		// also delete from datastore
		let subscriptionId = parseInt(subscription.labels.id);
		await datastore.delete('subscriptions', subscriptionId);

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
