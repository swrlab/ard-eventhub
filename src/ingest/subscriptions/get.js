/*

	ard-eventhub
	by SWR audio lab

*/

// load eventhub utils
const logger = require('../../utils/logger')
const pubsub = require('../../utils/pubsub')
const response = require('../../utils/response')

const source = 'ingest/subscriptions/get'

module.exports = async (req, res) => {
	try {
		// preset vars
		const { subscriptionName } = req.params
		let subscription

		// load single subscription
		try {
			subscription = await pubsub.getSubscription(subscriptionName)
			subscription = subscription.limited
		} catch (err) {
			return response.notFound(req, res, {
				status: 404,
				message: `Subscription '${subscriptionName}' not found`,
			})
		}

		// verify if user is allowed to get subscription (same institution)
		if (subscription.institutionId !== req.user.institutionId) {
			const userInstitution = req.user.institutionId

			// return 400 error
			return response.badRequest(req, res, {
				status: 400,
				message: `Mismatch of user and subscription institution`,
				errors: `Subscription of this institution is not visible for user of institution '${userInstitution}'`,
			})
		}

		// return data
		return res.status(200).json(subscription)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to get subscription',
			source,
			error,
			data: { params: req.params },
		})

		return response.internalServerError(req, res, error)
	}
}
