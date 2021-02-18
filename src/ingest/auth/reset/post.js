/*

	ard-eventhub
	by SWR audio lab

*/

// load eventhub utils
const firebase = require('../../../utils/firebase');
const response = require('../../../utils/response');

module.exports = async (req, res) => {
	try {
		// try to reset email (may fail if not found)
		try {
			let request = await firebase.sendPasswordResetEmail(req.body.email);
		} catch (err) {
			return response.badRequest(req, res, {
				status: err.error && err.error.code ? err.error.code : 500,
				data: err,
			});
		}

		// return ok
		return response.ok(req, res, { valid: true });
	} catch (err) {
		console.error(
			'ingest/auth/reset',
			'failed to reset password',
			JSON.stringify({
				headers: req.headers,
				error: err.stack || err,
			})
		);
		return response.internalServerError(req, res, err);
	}
};
