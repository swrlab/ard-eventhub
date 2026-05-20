/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Request, Response } from 'express'
import type { JwtPayload } from 'jsonwebtoken'
import { DateTime } from 'luxon'

import firebaseRefreshToken from '../../../utils/firebase/refreshToken'
import responseOk from '../../../utils/response/ok.ts'
import responseBadRequest from '../../../utils/response/badRequest.ts'
import responseInternalServerError from '../../../utils/response/internalServerError.ts'

const source = 'ingest/auth/refresh'

export default async (req: Request, res: Response) => {
	try {
		let login: Awaited<{
			user: JwtPayload | string | null
			login: any
		}>

		// swap previously received refresh token for new id token
		try {
			login = await firebaseRefreshToken(req.body.refreshToken)
		} catch (_error) {
			return responseBadRequest(req, res, { status: 500 })
		}

		// return ok
		const expiresIn = Number.parseInt(login.login.expires_in, 10)
		return responseOk(req, res, {
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
			data: { headers: req.headers },
		})

		return responseInternalServerError(req, res, error as Error)
	}
}
