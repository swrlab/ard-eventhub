import type { MiddlewareHandler } from 'hono'
import type { AuthUser } from '#types'
import type { RequestError } from '../../schemas/common.ts'
import logger from '@frytg/logger'
import { firebaseVerifyToken } from '../../utils/firebase/verify-token.ts'
import { getSafeHeaders } from '../../utils/get-safe-headers.ts'
import { badRequest } from '../../utils/response/bad-request.ts'
import { responseInternalServerError } from '../../utils/response/internal-server-error.ts'
import { getConfigUser } from '../../utils/users/get-user.ts'

const source = 'ingest/auth/middleware/verify'
const ERROR_JSON = { message: 'Forbidden', errors: [], status: 403, trace: null }

/** OpenAPI `errorUnauthorized` body for missing Bearer / x-authorization. */
const unauthorizedError: RequestError = {
	status: 401,
	message: "request.headers should have required property 'Authorization'",
	errors: [
		{
			path: '.headers.authorization',
			message: "should have required property 'authorization'",
			errorCode: 'required.openapi.validation',
		},
	],
}

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
			return badRequest(c, unauthorizedError)
		}
		// extract token
		;[authorization] = authorization.match(regexp) || []

		if (!authorization) {
			logger.notice({ message: 'user token missing', source, data: getSafeHeaders(c.req.raw.headers) })
			return badRequest(c, unauthorizedError)
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

		return responseInternalServerError(c)
	}
}
