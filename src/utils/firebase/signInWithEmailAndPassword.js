/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const jwt = require('jsonwebtoken')

// load utils
const logger = require('../logger')
const undici = require('../undici')

const source = 'firebase.signInWithEmailAndPassword'

module.exports = async (email, password) => {
	// set firebase sign in url
	const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`

	// query firebase
	const { statusCode, json: response } = await undici(url, {
		method: 'POST',
		timeout: 4e3,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			email,
			password,
			returnSecureToken: true,
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
	const user = jwt.decode(response.idToken)

	// return data
	return Promise.resolve({ user, login: response })
}
