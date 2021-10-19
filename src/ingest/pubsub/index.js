/*

	ard-eventhub
	by SWR audio lab

*/

// load utils
const logger = require('../../utils/logger')
const plugins = require('../../utils/plugins')

const source = 'pubsub'

module.exports = async (req, res) => {
	try {
		// get metadata from pubsub body
		const attributes = req.body?.message?.attributes
		const messageId = req.body?.message?.messageId
		const { subscription } = req.body

		// get message from pubsub or tasks
		let job = req.body?.message?.data ? Buffer.from(req.body.message.data, 'base64').toString() : req.body
		job = req.headers['x-skip-parsing'] ? job : JSON.parse(job)

		// insert data into job
		job.messageId = messageId
		job.attributes = attributes
		job.subscription = subscription

		// handle actions
		if (job.action === 'plugins.dts.event') {
			await plugins.dts.event(job)
		} else {
			logger.log({
				level: 'warning',
				message: 'undetected PubSub message action',
				source,
				data: { messageId, job, headers: req.headers },
			})
		}

		// return ok
		return res.sendStatus(201)
	} catch (error) {
		const messageId = req.body?.message?.messageId
		logger.log({
			level: 'error',
			message: 'error while processing PubSub message',
			source,
			error,
			data: { messageId, body: req.body, headers: req.headers },
		})

		return res.sendStatus(204)
	}
}
