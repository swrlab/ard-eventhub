/*

	ard-eventhub
	by SWR audio lab

*/

// load utils
const jwtVerify = require('../../utils/jwtVerify');
const userUtils = require('../../utils/user');

module.exports = async (req, res, next) => {
	try {
		// Do some magic here...
		req.user = 'DEV'

		// continue with normal workflow
		next();
	} catch (err) {
		return res.status(500);
	}
};
