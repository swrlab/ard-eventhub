import logger from '@frytg/logger'
import { createMiddleware } from 'hono/factory'
import { OAuth2Client } from 'google-auth-library'

import type { AppVariables } from '@/src/ingest/types.ts'

const authClient = new OAuth2Client()
const serviceAccountEmail = process.env.PUBSUB_SERVICE_ACCOUNT_EMAIL_INTERNAL
const source = 'ingest/pubsub/verify'

export default createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
	try {
		const bearer = c.req.header('Authorization')

		if (!bearer?.match(/Bearer (.*)/)) {
			return c.body(null, 401)
		}

		const [_ignore, idToken] = bearer.match(/Bearer (.*)/) || []

		if (idToken == null) throw Error('No ID token could be found.')

		c.set('pubsubUser', await authClient.verifyIdToken({ idToken }))

		if (c.get('pubsubUser')?.getPayload()?.email !== serviceAccountEmail) {
			return c.body(null, 204)
		}

		return next()
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
})
