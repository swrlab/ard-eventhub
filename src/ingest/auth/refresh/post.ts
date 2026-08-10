import type { Context } from 'hono'
import type { JwtPayload } from 'jsonwebtoken'
import type { AuthRefreshBody } from '../../../schemas/auth.ts'
import { getNow } from '@frytg/dates'
import logger from '@frytg/logger'
import { firebaseRefreshToken } from '../../../utils/firebase/refresh-token.ts'
import { getSafeHeaders } from '../../../utils/get-safe-headers.ts'
import { badRequest as responseBadRequest } from '../../../utils/response/bad-request.ts'
import { responseInternalServerError } from '../../../utils/response/internal-server-error.ts'
import { responseOk } from '../../../utils/response/ok.ts'
import { getValidatedBody } from '../../../utils/validation/zod-validate.ts'

const source = 'ingest/auth/refresh'

type JwtLogin = {
	expires_in: string
	id_token: string
	refresh_token: string
}

/**
 * Swap refresh token for a new id token.
 * @param c - Hono context
 * @returns Auth response
 */
export const authRefreshPost = async (c: Context) => {
	const body = getValidatedBody<AuthRefreshBody>(c)
	try {
		let login: Awaited<{
			user: JwtPayload | string | null
			login: JwtLogin
		}>

		// swap previously received refresh token for new id token
		try {
			login = await firebaseRefreshToken(body.refreshToken as string)
		} catch (error) {
			return responseBadRequest(c, {
				status: 500,
				message: `Could not refresh login > ${(error as Error)?.message ?? error}`,
			})
		}

		const expiresIn = Number.parseInt(login.login.expires_in, 10)
		return responseOk(c, {
			expiresIn,
			expires: getNow().plus({ seconds: expiresIn }).toISO(),

			token: login.login.id_token,
			refreshToken: login.login.refresh_token,

			user: login.user,
		})
	} catch (error) {
		logger.error({
			message: 'failed to refresh token',
			source,
			error,
			data: { headers: getSafeHeaders(c.req.raw.headers) },
		})

		return responseInternalServerError(c, error as Error)
	}
}
