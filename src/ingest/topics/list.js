/*

	ard-eventhub
	by SWR audio lab

*/

const logger = require('../../utils/logger')
const pubsub = require('../../utils/pubsub')
const response = require('../../utils/response')

const source = 'ingest/topics/list'

module.exports = async (req, res) => {
	try {
		// load all topics
		const topics = await pubsub.getTopics()

		// return data
		return res.status(200).json(topics)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to list topics',
			source,
			error,
			data: {},
		})

		return response.internalServerError(req, res, error)
	}
}
