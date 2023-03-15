/*

	ard-eventhub
	by SWR Audio Lab

*/

// load eventhub utils
const firebase = require('../../../utils/firebase')
const logger = require('../../../utils/logger')
const response = require('../../../utils/response')

const source = 'ingest/auth/reset'

module.exports = async (req, res) => {
	try {
		// try to reset email (may fail if not found)
		try {
			await firebase.sendPasswordResetEmail(req.body.email)
		} catch (error) {
			logger.log({
				level: 'notice',
				message: 'failed resetting password',
				source,
				error,
				data: { email: req.body.email },
			})

			return response.badRequest(req, res, { status: error?.error?.code || 500, data: error })
		}

		// return ok
		return response.ok(req, res, { valid: true })
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to reset password',
			source,
			error,
			data: { body: req.body, headers: req.headers },
		})

		return response.internalServerError(req, res, error)
	}
}
