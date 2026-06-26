/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Context } from 'hono'
import type { JwtPayload } from 'jsonwebtoken'
import { DateTime } from 'luxon'

import firebaseRefreshToken from '@/src/utils/firebase/refreshToken.ts'
import responseOk from '@/src/utils/response/ok.ts'
import responseBadRequest from '@/src/utils/response/badRequest.ts'
import responseInternalServerError from '@/src/utils/response/internalServerError.ts'
import type { authRefreshBodySchema } from '@/src/ingest/schemas/auth.ts'
import type * as z from 'zod'

const source = 'ingest/auth/refresh'

type RefreshBody = z.infer<typeof authRefreshBodySchema>

export default async (c: Context, body: RefreshBody) => {
	try {
		let login: Awaited<{
			user: JwtPayload | string | null
			login: any
		}>

		try {
			login = await firebaseRefreshToken(body.refreshToken)
		} catch (_error) {
			return responseBadRequest(c, { status: 500 })
		}

		const expiresIn = Number.parseInt(login.login.expires_in, 10)
		return responseOk(c, {
			expiresIn,
			expires: DateTime.now().plus({ seconds: expiresIn }).toISO(),
			token: login.login.id_token,
			refreshToken: login.login.refresh_token,
			user: login.user,
		})
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to refresh token',
			source,
			error,
			data: { headers: Object.fromEntries(c.req.raw.headers) },
		})

		return responseInternalServerError(c, error as Error)
	}
}
