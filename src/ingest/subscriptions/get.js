/*

	ard-eventhub
	by SWR audio lab

*/

// load eventhub utils
const pubsub = require('../../utils/pubsub')
const response = require('../../utils/response')

module.exports = async (req, res) => {
	try {
		// preset vars
		const { subscriptionName } = req.params
		let subscription

		// load single subscription
		try {
			subscription = await pubsub.getSubscription(subscriptionName)
		} catch (err) {
			return response.notFound(req, res, {
				status: 404,
				message: `Subscription '${subscriptionName}' not found`,
			})
		}

		// verify if user is allowed to get subscription (same institution)
		if (subscription.institution.id !== req.user.institution.id) {
			let subsOrg = subscription.institution.name
			let userOrg = req.user.institution.name
			// return 400 error
			return response.badRequest(req, res, {
				status: 400,
				message: `Mismatch of user and subscription institution`,
				errors: `Subscription of institution '${subsOrg}' is not visible for user of institution '${userOrg}'`,
			})
		}

		// return data
		return res.status(200).json(subscription)
	} catch (err) {
		console.error(
			'ingest/subscriptions/get',
			'failed to get subscription',
			JSON.stringify({
				body: req.body,
				error: err.stack || err,
			})
		)
		return response.internalServerError(req, res, err)
	}
}
