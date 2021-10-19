/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const moment = require('moment')

// load eventhub utils
const firebase = require('../../../utils/firebase')
const logger = require('../../../utils/logger')
const response = require('../../../utils/response')

const source = 'ingest/auth/refresh'

module.exports = async (req, res) => {
	try {
		let login

		// swap previously received refresh token for new id token
		try {
			login = await firebase.refreshToken(req.body.refreshToken)
		} catch (err) {
			return response.badRequest(req, res, {
				status: err.error && err.error.code ? err.error.code : 500,
				data: err,
			})
		}

		// return ok
		return response.ok(req, res, {
			expiresIn: parseInt(login.login.expires_in),
			expires: moment().add(parseInt(login.login.expires_in), 's').toISOString(),

			token: login.login.id_token,
			refreshToken: login.login.refresh_token,

			user: login.user,
		})
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to refresh token',
			source,
			error,
			data: { headers: req.headers },
		})

		return response.internalServerError(req, res, error)
	}
}
