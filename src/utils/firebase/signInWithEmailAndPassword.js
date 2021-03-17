/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const fetch = require('node-fetch')
const jwt = require('jsonwebtoken')

// load eventhub utils
const config = require('../../../config')

module.exports = async (email, password) => {
	// set firebase sign in url
	const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`

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
			email,
			password,
			returnSecureToken: true,
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
	const user = jwt.decode(response.idToken)

	// return data
	return Promise.resolve({ user, login: response })
}
