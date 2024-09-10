/*

	ard-eventhub
	by SWR Audio Lab

*/

// load node utils
const { DateTime } = require('luxon')

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
		} catch (_error) {
			return response.badRequest(req, res, { status: 500 })
		}

		// return ok
		const expiresIn = Number.parseInt(login.login.expires_in)
		return response.ok(req, res, {
			expiresIn,
			expires: DateTime.now().plus({ seconds: expiresIn }).toISO(),

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
