import type { Context } from 'hono'
import type { JwtPayload } from 'jsonwebtoken'
import type { AuthLoginBody } from '../../../schemas/auth.ts'
import { getNow } from '@frytg/dates'
import logger from '@frytg/logger'
import { firebaseSignIn } from '../../../utils/firebase/sign-in-with-email-and-password.ts'
import { getSafeHeaders } from '../../../utils/get-safe-headers.ts'
import { badRequest as responseBadRequest } from '../../../utils/response/bad-request.ts'
import { responseInternalServerError } from '../../../utils/response/internal-server-error.ts'
import { responseOk } from '../../../utils/response/ok.ts'
import { getValidatedBody } from '../../../utils/validation/zod-validate.ts'

const source = 'ingest/auth/login'

type Login = {
	expiresIn: string
	idToken: string
	refreshToken: string
}

/**
 * Swap login credentials for a token.
 * @param c - Hono context
 * @returns Auth response
 */
export const authLoginPost = async (c: Context) => {
	const body = getValidatedBody<AuthLoginBody>(c)
	try {
		let login: Awaited<{
			user: JwtPayload | string | null
			login: Login
		}>

		// send email + password for verification, receive login and user object
		try {
			login = await firebaseSignIn(body.email as string, body.password as string)
		} catch {
			return responseBadRequest(c, { status: 500, message: 'Could not login.' })
		}

		const expiresIn = Number.parseInt(login.login.expiresIn, 10)
		return responseOk(c, {
			expiresIn,
			expires: getNow().plus({ seconds: expiresIn }).toISO(),

			token: login.login.idToken,
			refreshToken: login.login.refreshToken,

			user: login.user,
		})
	} catch (error) {
		logger.error({
			message: 'failed to sign in w/ email+password',
			source,
			error,
			data: { headers: getSafeHeaders(c.req.raw.headers) },
		})

		return responseInternalServerError(c, error as Error)
	}
}
