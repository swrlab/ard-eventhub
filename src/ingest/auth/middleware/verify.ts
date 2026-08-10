import type { MiddlewareHandler } from 'hono'
import type { AuthUser } from '#types'
import logger from '@frytg/logger'
import { datastoreLoad } from '../../../utils/datastore/load.ts'
import { firebaseVerifyToken } from '../../../utils/firebase/verify-token.ts'
import { getSafeHeaders } from '../../../utils/get-safe-headers.ts'

const source = 'ingest/auth/middleware/verify'
const ERROR_JSON = { message: 'Forbidden', errors: [], status: 403 }

/**
 * Verify Bearer / x-authorization JWT, load active user, and set `c.get('user')`.
 * @returns Hono middleware
 */
export const authVerify: MiddlewareHandler = async (c, next) => {
	try {
		// parse input, preset vars
		const regexp = /(?!Bearer\s{1})([a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+)/g
		let authorization = c.req.header('x-authorization') || c.req.header('authorization')

		// check existence of x-auth... header
		if (!(authorization && regexp.test(authorization))) {
			logger.notice({
				message: 'user token missing',
				source,
				data: getSafeHeaders(c.req.raw.headers),
			})
			return c.body(null, 401)
		}
		// extract token
		;[authorization] = authorization.match(regexp) || []

		if (!authorization) {
			logger.notice({
				message: 'user token missing',
				source,
				data: getSafeHeaders(c.req.raw.headers),
			})
			return c.body(null, 401)
		}

		// validate JWT token with firebase
		let user: AuthUser
		try {
			user = await firebaseVerifyToken(authorization)
			c.set('user', user)
			c.header('x-ard-eventhub-uid', user.uid)
		} catch (error) {
			logger.notice({ message: 'user token invalid', source, error, data: getSafeHeaders(c.req.raw.headers) })
			return c.json(ERROR_JSON, 403)
		}

		if (!user.email) {
			logger.notice({
				message: 'user email missing',
				source,
				data: getSafeHeaders(c.req.raw.headers),
			})
			return c.json(ERROR_JSON, 403)
		}

		// lookup user in DB
		const userDb = await datastoreLoad('users', user.email)

		// check if profile exists and valid
		if (userDb?.active !== true) {
			logger.notice({
				message: 'user not found or not active',
				source,
				data: getSafeHeaders(c.req.raw.headers),
			})
			return c.json(ERROR_JSON, 403)
		}

		// add user details to request profile
		user.institutionId = userDb.institutionId
		c.set('user', user)

		// continue with normal workflow, user is authenticated 🎉
		await next()
		return
	} catch (error) {
		logger.error({
			message: 'failed to verify user',
			source,
			error,
			data: getSafeHeaders(c.req.raw.headers),
		})

		return c.body(null, 500)
	}
}
