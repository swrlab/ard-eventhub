import logger from '@frytg/logger'
import { decode } from 'jsonwebtoken'
import { defaultHeaders } from '#config'
import { firebaseAPIKey } from '#env'

const source = 'firebase.signInWithEmailAndPassword'

export default async (email: string, password: string) => {
	// set firebase sign in url
	const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseAPIKey}`

	try {
		// query firebase
		const response = await globalThis.fetch(url, {
			method: 'POST',
			signal: AbortSignal.timeout(4e3),
			headers: {
				...defaultHeaders,
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				email,
				password,
				returnSecureToken: true,
			}),
		})

		// handle errors (non-200 status)
		if (response.status !== 200) {
			const message = `failed with status > ${response.status}`

			const text = await response.text().catch(() => '')

			logger.log({
				source,
				level: 'warning',
				message,
				data: { statusCode: response.status, response: { statusText: response.statusText, text } },
			})

			throw new Error(message)
		}
		const json = await response.json()

		// decode JWT token to receive user object
		const user = decode(json.idToken)
		return { user, login: json }
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		logger.log({
			source,
			level: 'warning',
			message: `failed with error > ${errorMessage}`,
			data: { error },
		})

		// rethrow error
		throw new Error('the request failed', { cause: error })
	}
}
