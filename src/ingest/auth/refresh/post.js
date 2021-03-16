/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const moment = require('moment');

// load eventhub utils
const firebase = require('../../../utils/firebase');
const response = require('../../../utils/response');

module.exports = async (req, res) => {
	try {
		let login;

		// swap previously received refresh token for new id token
		try {
			login = await firebase.refreshToken(req.body.refreshToken);
		} catch (err) {
			return response.badRequest(req, res, {
				status: err.error && err.error.code ? err.error.code : 500,
				data: err,
			});
		}

		// return ok
		return response.ok(req, res, {
			expiresIn: parseInt(login.login.expires_in),
			expires: moment().add(parseInt(login.login.expires_in), 's').toISOString(),

			token: login.login.id_token,
			refreshToken: login.login.refresh_token,
			
			user: login.user,
		});
	} catch (err) {
		console.error(
			'ingest/auth/refresh',
			'failed to refresh token',
			JSON.stringify({
				headers: req.headers,
				error: err.stack || err,
			})
		);
		return response.internalServerError(req, res, err);
	}
};
