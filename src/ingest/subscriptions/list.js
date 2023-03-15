/*

	ard-eventhub
	by SWR Audio Lab

*/

// load eventhub utils
const logger = require('../../utils/logger')
const pubsub = require('../../utils/pubsub')
const response = require('../../utils/response')

const source = 'ingest/subscriptions/list'

module.exports = async (req, res) => {
	try {
		// load all subscriptions
		let subscriptions = await pubsub.getSubscriptions()

		// verify if user is allowed to list subscriptions (same institution)
		subscriptions = subscriptions.filter(
			(subscription) => subscription?.institutionId === req.user.institutionId
		)

		// return data
		return res.status(200).json(subscriptions)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to list subscriptions',
			source,
			error,
			data: {},
		})

		return response.internalServerError(req, res, error)
	}
}
