import logger from '@frytg/logger'
import { createMiddleware } from 'hono/factory'

import datastoreLoad from '@/src/utils/datastore/load.ts'
import firebaseVerifyToken from '@/src/utils/firebase/verifyToken.ts'
import type { AppVariables } from '@/src/ingest/types.ts'

const source = 'ingest/auth/middleware/verify'
const ERROR_JSON = { message: 'Forbidden', errors: [] }

export default createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
	try {
		const regexp = /(?!Bearer\s{1})([a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+)/g
		let authorization = c.req.header('x-authorization') || c.req.header('authorization')

		if (!authorization || !regexp.test(authorization)) {
			logger.log({
				level: 'notice',
				message: 'user token missing',
				source,
				data: { ...Object.fromEntries(c.req.raw.headers), authorization: 'hidden' },
			})
			return c.body(null, 401)
		}

		;[authorization] = authorization.match(regexp) || []

		if (!authorization) {
			logger.log({
				level: 'notice',
				message: 'user token missing',
				source,
				data: { ...Object.fromEntries(c.req.raw.headers), authorization: 'hidden' },
			})
			return c.body(null, 401)
		}

		try {
			const user = await firebaseVerifyToken(authorization)
			c.set('user', user)
			c.header('x-ard-eventhub-uid', user.uid)
		} catch (error) {
			logger.log({
				level: 'notice',
				message: 'user token invalid',
				source,
				error,
				data: { ...Object.fromEntries(c.req.raw.headers), authorization: 'hidden' },
			})
			return c.json(ERROR_JSON, 403)
		}

		const user = c.get('user')

		if (!user?.email) {
			logger.log({
				level: 'notice',
				message: 'user email missing',
				source,
				data: { ...Object.fromEntries(c.req.raw.headers), authorization: 'hidden' },
			})
			return c.json(ERROR_JSON, 403)
		}

		const userDb = await datastoreLoad('users', user.email)

		if (!userDb || userDb.active !== true) {
			logger.log({
				level: 'notice',
				message: 'user not found or not active',
				source,
				data: { ...Object.fromEntries(c.req.raw.headers), authorization: 'hidden' },
			})
			return c.json(ERROR_JSON, 403)
		}

		user.institutionId = userDb.institutionId

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
