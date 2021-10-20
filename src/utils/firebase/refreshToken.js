/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const jwt = require('jsonwebtoken')

// load utils
const logger = require('../logger')
const undici = require('../undici')

const source = 'firebase.refreshToken'

module.exports = async (refreshToken) => {
	// set firebase sign in url
	const url = `https://securetoken.googleapis.com/v1/token?key=${process.env.FIREBASE_API_KEY}`

	// query firebase
	const { statusCode, json: response } = await undici(url, {
		method: 'POST',
		timeout: 4e3,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
		}),
	})

	// handle errors
	if (statusCode !== 200) {
		logger.log({
			source,
			level: 'warning',
			message: `failed with status > ${statusCode}`,
			data: { statusCode, response },
		})

		return Promise.reject(new Error(response))
	}

	// decode JWT token to receive user object
	const user = jwt.decode(response.id_token)

	// return data
	return Promise.resolve({ login: response, user })
}
