import logger from '@frytg/logger'
import { defaultHeaders } from '#config'
import { firebaseAPIKey } from '#env'

const source = 'firebase.sendPasswordResetEmail'

export default async (email: string): Promise<void> => {
	// set firebase sign in url
	const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseAPIKey}`

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
			requestType: 'PASSWORD_RESET',
			email,
		}),
	})
	const text = await response.text()

	logger.log({
		source,
		level: 'warning',
		message: `failed with status > ${response.status}`,
		data: { statusCode: response.status, response },
	})

	if (response.status !== 200) {
		throw new Error(text)
	}
}
