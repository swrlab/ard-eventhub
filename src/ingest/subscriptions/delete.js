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

		// check subscription permission by user institution
		if (subscription.institution.id !== req.user.institution.id) {
			let subsOrg = subscription.institution.name;
			let userOrg = req.user.institution.name;
			// return 400 error
			return response.badRequest(req, res, {
				status: 400,
				message: `Mismatch of user and subscription institution`,
				errors: `Subscription of institution '${subsOrg}' cannot be deleted by user of institution '${userOrg}'`,
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
