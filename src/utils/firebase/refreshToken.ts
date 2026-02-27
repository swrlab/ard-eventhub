import logger from '@frytg/logger'
import { decode } from 'jsonwebtoken'
import { defaultHeaders } from '#config'
import { firebaseAPIKey } from '#env'

const source = 'firebase.refreshToken'

export default async (refreshToken: string) => {
	// set firebase sign in url
	const url = `https://securetoken.googleapis.com/v1/token?key=${firebaseAPIKey}`

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
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
		}),
	})

	// handle errors
	if (response.status !== 200) {
		logger.log({
			source,
			level: 'warning',
			message: `failed with status > ${response.status}`,
			data: { statusCode: response.status, response },
		})

		const text = await response.text()
		throw new Error(text)
	}

	const json = await response.json()

	// decode JWT token to receive user object
	const user = decode(json.id_token)

	return { login: json, user }
}
