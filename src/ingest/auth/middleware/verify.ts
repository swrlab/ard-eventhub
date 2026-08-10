import type { MiddlewareHandler } from 'hono'
import type { AuthUser } from '#types'
import logger from '@frytg/logger'
import { firebaseVerifyToken } from '../../../utils/firebase/verify-token.ts'
import { getSafeHeaders } from '../../../utils/get-safe-headers.ts'
import { getConfigUser } from '../../../utils/users/get-user.ts'

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
			logger.notice({ message: 'user token missing', source, data: getSafeHeaders(c.req.raw.headers) })
			return c.body(null, 401)
		}
		// extract token
		;[authorization] = authorization.match(regexp) || []

		if (!authorization) {
			logger.notice({ message: 'user token missing', source, data: getSafeHeaders(c.req.raw.headers) })
			return c.body(null, 401)
		}

		// validate JWT token with firebase
		let tokenUser: Awaited<ReturnType<typeof firebaseVerifyToken>>
		try {
			tokenUser = await firebaseVerifyToken(authorization)
		} catch (error) {
			logger.notice({ message: 'user token invalid', source, error, data: getSafeHeaders(c.req.raw.headers) })
			return c.json(ERROR_JSON, 403)
		}

		if (!tokenUser.email) {
			logger.notice({
				message: 'user email missing',
				source,
				data: getSafeHeaders(c.req.raw.headers),
			})
			return c.json(ERROR_JSON, 403)
		}

		// lookup user in local allow-list (`src/config/users.json`)
		const configUser = getConfigUser(tokenUser.email)

		if (!configUser) {
			logger.notice({ message: `user not found > ${tokenUser.email}`, source, data: getSafeHeaders(c.req.raw.headers) })
			return c.json(ERROR_JSON, 403)
		}

		const user: AuthUser = {
			...tokenUser,
			institution: {
				id: configUser.institutionId,
				name: configUser.institution,
			},
		}
		c.set('user', user)

		// continue with normal workflow, user is authenticated 🎉
		await next()
		return
	} catch (error) {
		logger.error({ message: 'failed to verify user', source, error, data: getSafeHeaders(c.req.raw.headers) })

		return c.body(null, 500)
	}
}
