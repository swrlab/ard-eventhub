/*

	ard-eventhub
	by SWR audio lab

*/

// load eventhub utils
const datastore = require('../../utils/datastore')
const logger = require('../../utils/logger')
const pubsub = require('../../utils/pubsub')
const response = require('../../utils/response')

module.exports = async (req, res) => {
	try {
		// preset vars
		const { subscriptionName } = req.params
		let subscription

		// load single subscription to get owner
		try {
			subscription = await pubsub.getSubscription(subscriptionName)
			subscription = subscription.full
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
			)

			if (err?.code === 5) {
				// pubsub error code 5 seems to be 'Resource not found'
				return response.notFound(req, res, {
					status: 404,
					message: `Subscription '${subscriptionName}' not found`,
				})
			}

			// return generic error
			return response.badRequest(req, res, {
				status: 500,
				message: 'Error while loading desired subscription',
			})
		}

		// check subscription permission by user institution
		if (subscription.institutionId !== req.user.institutionId) {
			const userInstitution = req.user.institutionId

			// return 400 error
			return response.badRequest(req, res, {
				status: 400,
				message: `Mismatch of user and subscription institution`,
				errors: `Subscription of this institution cannot be deleted by user of institution '${userInstitution}'`,
			})
		}

		// request actual deletion
		await pubsub.deleteSubscription(subscriptionName)

		// also delete from datastore
		const subscriptionId = parseInt(subscription.labels.id)
		await datastore.delete('subscriptions', subscriptionId)

		// log progress
		logger.log({
			level: 'info',
			message: 'removed subscription',
			source: 'ingest/subscriptions/delete',
			data: { email: req.user.email, subscriptionName, subscriptionId, subscription },
		})

		// return data
		return response.ok(req, res, {
			valid: true,
		})
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to delete subscription',
			source: 'ingest/subscriptions/delete',
			error,
			data: { params: req.params },
		})

		return response.internalServerError(req, res, error)
	}
}
