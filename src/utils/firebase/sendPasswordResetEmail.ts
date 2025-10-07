/*

	ard-eventhub
	by SWR Audio Lab

*/

// load utils
import logger from '../logger'
import undici from '../undici'

const source = 'firebase.sendPasswordResetEmail'

export default async (email: any) => {
	// set firebase sign in url
	const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.FIREBASE_API_KEY}`

	// query firebase
	const { statusCode, json: response } = await undici(url, {
		method: 'POST',
		timeout: 4e3,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			requestType: 'PASSWORD_RESET',
			email,
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

	// return ok
	return Promise.resolve()
}
