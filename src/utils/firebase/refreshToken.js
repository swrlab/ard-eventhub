/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const fetch = require('node-fetch')
const jwt = require('jsonwebtoken')

// load eventhub utils
const config = require('../../../config')

module.exports = async (refreshToken) => {
	// set firebase sign in url
	const url = `https://securetoken.googleapis.com/v1/token?key=${process.env.FIREBASE_API_KEY}`

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
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
		}),
	})

	// parse json response
	const response = await request.json()

	// handle errors
	if (request.status !== 200) {
		console.warn(
			'utils/firebase/refreshToken',
			'failed with status',
			request.status,
			'>',
			JSON.stringify(response)
		)

		return Promise.reject(response)
	}

	// decode JWT token to receive user object
	const user = jwt.decode(response.id_token)

	// return data
	return Promise.resolve({ login: response, user })
}
