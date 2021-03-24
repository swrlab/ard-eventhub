/*

	ard-eventhub
	by SWR audio lab

*/

// load utils
const datastore = require('../../../utils/datastore')
const firebase = require('../../../utils/firebase')
const logger = require('../../../utils/logger')

module.exports = async (req, res, next) => {
	try {
		// parse input, preset vars
		const regexp = /(?!Bearer\s{1})([a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+)/g
		let authorization = req.headers['x-authorization'] || req.headers.authorization

		// check existence of x-auth... header
		if (!authorization || !regexp.test(authorization)) {
			return res.sendStatus(401)
		}

		// extract token
		;[authorization] = authorization.match(regexp)

		// validate JWT token with firebase
		try {
			// successful verifications will save JWT user profile to req
			req.user = await firebase.verifyToken(authorization)
			res.set('x-ard-eventhub-uid', req.user.uid)
		} catch (err) {
			logger.log({
				level: 'notice',
				message: 'user token invalid',
				source: 'ingest/auth/middleware/verify',
				data: { ...req.headers, authorization: 'hidden' },
			})
			return res.sendStatus(403)
		}

		// lookup user in DB
		const userDb = await datastore.load('users', req.user.email)

		// check if profile exists and valid
		if (!userDb || userDb.active !== true) {
			return res.sendStatus(403)
		}

		// add user details to request profile
		req.user.institutionId = userDb.institutionId

		// continue with normal workflow, user is authenticated 🎉
		return next()
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to verify user',
			source: 'ingest/auth/middleware/verify',
			error,
			data: { ...req.headers, authorization: 'hidden' },
		})

		return res.sendStatus(500)
	}
}
