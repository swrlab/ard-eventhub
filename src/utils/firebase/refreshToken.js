/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

// load eventhub utils
const loggerDev = require('../loggerDev');

module.exports = async (refreshToken) => {
	// set firebase sign in url
	let url = `https://securetoken.googleapis.com/v1/token?key=${process.env.FIREBASE_API_KEY}`;

	// query firebase
	let request = await fetch(url, {
		method: 'post',
		timeout: 4 * 1000,
		headers: {
			Accept: 'application/json',
			Connection: 'keep-alive',
			'Content-Type': 'application/json',
			'User-Agent': global.AGENT,
		},
		body: JSON.stringify({
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
		}),
	});

	// parse json response
	let response = await request.json();

	// handle errors
	if (request.status != 200) {
		console.warn(
			'utils/firebase/refreshToken',
			'failed with status',
			request.status,
			'>',
			JSON.stringify(response)
		);

		return Promise.reject(response);
	}

	// decode JWT token to receive user object
	let user = jwt.decode(response.id_token);

	// return data
	return Promise.resolve({ login: response, user });
};
