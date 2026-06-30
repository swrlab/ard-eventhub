/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Context } from 'hono'
import type { JwtPayload } from 'jsonwebtoken'
import { DateTime } from 'luxon'

import firebaseSignIn from '@/src/utils/firebase/signInWithEmailAndPassword.ts'
import responseOk from '@/src/utils/response/ok.ts'
import responseBadRequest from '@/src/utils/response/badRequest.ts'
import responseInternalServerError from '@/src/utils/response/internalServerError.ts'
import type { authLoginBodySchema } from '@/src/ingest/schemas/auth.ts'
import type * as z from 'zod'

const source = 'ingest/auth/login'

type LoginBody = z.infer<typeof authLoginBodySchema>

export default async (c: Context, body: LoginBody) => {
	try {
		let login: Awaited<{ user: JwtPayload | string | null; login: any }>

		try {
			login = await firebaseSignIn(body.email, body.password)
		} catch (_error) {
			return responseBadRequest(c, { status: 500 })
		}

		const expiresIn = Number.parseInt(login.login.expiresIn, 10)
		return responseOk(c, {
			expiresIn,
			expires: DateTime.now().plus({ seconds: expiresIn }).toISO(),
			token: login.login.idToken,
			refreshToken: login.login.refreshToken,
			user: login.user,
		})
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to sign in w/ email+password',
			source,
			error,
			data: { headers: Object.fromEntries(c.req.raw.headers) },
		})

		return responseInternalServerError(c, error as Error)
	}
}
