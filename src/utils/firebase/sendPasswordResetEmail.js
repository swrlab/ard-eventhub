/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const fetch = require('node-fetch');

// load eventhub utils
const config = require('../../../config');

module.exports = async (email) => {
	// set firebase sign in url
	const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.FIREBASE_API_KEY}`;

	// query firebase
	const request = await fetch(url, {
		method: 'post',
		timeout: 4 * 1000,
		headers: {
			Accept: 'application/json',
			Connection: 'keep-alive',
			'Content-Type': 'application/json',
			'User-Agent': config.userAgent,
		},
		body: JSON.stringify({
			requestType: 'PASSWORD_RESET',
			email,
		}),
	});

	// parse json response
	const response = await request.json();

	// handle errors
	if (request.status !== 200) {
		console.warn(
			'utils/firebase/refreshToken',
			'failed with status',
			request.status,
			'>',
			JSON.stringify(response)
		);

		return Promise.reject(response);
	}

	// return data
	return Promise.resolve();
};
