/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const datastore = require('../../../utils/datastore')
const firebase = require('../../../utils/firebase')

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
			console.warn(
				'ingest/auth/middleware/verify',
				'user token invalid',
				JSON.stringify({
					error: err.stack || err,
				})
			)
			return res.sendStatus(403)
		}

		// lookup user in DB
		const userDb = await datastore.load('users', req.user.email)

		// check if profile exists and valid
		if (!userDb || userDb.active !== true) {
			return res.sendStatus(403)
		}

		// add user details to request profile
		req.user.serviceIds = userDb.serviceIds
		req.user.institution = userDb.institution

		// continue with normal workflow, user is authenticated 🎉
		return next()
	} catch (err) {
		console.error(
			'ingest/auth/middleware/verify',
			'failed to verify user',
			JSON.stringify({
				error: err.stack || err,
			})
		)
		return res.sendStatus(500)
	}
}
