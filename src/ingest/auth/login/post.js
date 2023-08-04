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

const source = 'ingest/auth/login'

module.exports = async (req, res) => {
	try {
		let login

		// send email + password for verification, receive login and user object
		try {
			login = await firebase.signInWithEmailAndPassword(req.body.email, req.body.password)
		} catch (error) {
			return response.badRequest(req, res, { status: 500 })
		}

		// return ok
		const expiresIn = parseInt(login.login.expiresIn)
		return response.ok(req, res, {
			expiresIn,
			expires: DateTime.now().plus({ seconds: expiresIn }).toISO(),

			token: login.login.idToken,
			refreshToken: login.login.refreshToken,

			user: login.user,
		})
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to sign in w/ email+password',
			source,
			error,
			data: { headers: req.headers },
		})

		return response.internalServerError(req, res, error)
	}
}
