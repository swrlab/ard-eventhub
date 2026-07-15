import { getNow } from '@frytg/dates'
import logger from '@frytg/logger'
import type { Request, Response } from 'express'
import type { JwtPayload } from 'jsonwebtoken'
import firebaseRefreshToken from '../../../utils/firebase/refreshToken.ts'
import responseBadRequest from '../../../utils/response/badRequest.ts'
import responseInternalServerError from '../../../utils/response/internalServerError.ts'
import responseOk from '../../../utils/response/ok.ts'

const source = 'ingest/auth/refresh'

type JwtLogin = {
	expires_in: string
	id_token: string
	refresh_token: string
}

export default async (req: Request, res: Response) => {
	try {
		let login: Awaited<{
			user: JwtPayload | string | null
			login: JwtLogin
		}>

		// swap previously received refresh token for new id token
		try {
			login = await firebaseRefreshToken(req.body.refreshToken)
		} catch (error) {
			return responseBadRequest(req, res, {
				status: 500,
				message: `Could not refresh login > ${(error as Error)?.message ?? error}`,
			})
		}

		const expiresIn = Number.parseInt(login.login.expires_in, 10)
		return responseOk(req, res, {
			expiresIn,
			expires: getNow().plus({ seconds: expiresIn }).toISO(),

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
