import type { MiddlewareHandler } from 'hono'
import logger from '@frytg/logger'
import { OAuth2Client } from 'google-auth-library'
import { serviceAccountEmail } from '#env'

const authClient = new OAuth2Client()

const source = 'ingest/pubsub/verify'

/**
 * Verify Google OIDC bearer token for Pub/Sub push delivery.
 * @returns Hono middleware
 */
export const pubsubAuthVerify: MiddlewareHandler = async (c, next) => {
	try {
		// read token from header
		const bearer = c.req.header('Authorization')
		const bearerMatch = bearer?.match(/Bearer (.*)/)

		// check token email vs. subscription email
		if (!bearerMatch) {
			// user failed to provide auth header
			return c.body(null, 401)
		}

		const [_match, idToken] = bearerMatch
		if (!idToken) throw Error('No ID token could be found.')

		// verify token, throws error if invalid
		const user = await authClient.verifyIdToken({
			idToken,
		})

		// check token email vs. subscription email
		if (user?.getPayload()?.email !== serviceAccountEmail) {
			// user provided valid token but failed email verification
			return c.body(null, 204)
		}

		// continue with normal workflow, user is authenticated 🎉
		await next()
		return
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to verify user',
			source,
			error,
			data: { ...Object.fromEntries(c.req.raw.headers), authorization: 'hidden' },
		})

		return c.body(null, 500)
	}
}

