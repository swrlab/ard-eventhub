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

const source = 'ingest/auth/login'

module.exports = async (req, res) => {
	try {
		let login

		// send email + password for verification, receive login and user object
		try {
			login = await firebase.signInWithEmailAndPassword(req.body.email, req.body.password)
		} catch (err) {
			return response.badRequest(req, res, {
				status: err.error && err.error.code ? err.error.code : 500,
				data: err,
			})
		}

		// return ok
		return response.ok(req, res, {
			expiresIn: parseInt(login.login.expiresIn),
			expires: moment().add(parseInt(login.login.expiresIn), 's').toISOString(),

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
