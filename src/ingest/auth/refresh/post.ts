/*

	ard-eventhub
	by SWR Audio Lab

*/

// load node utils
import { DateTime } from 'luxon'

// load eventhub utils
import firebase from '../../../utils/firebase'
import logger from '../../../utils/logger'
import response from '../../../utils/response'
import { Request, Response } from 'express'
import { JwtPayload } from 'jsonwebtoken'

const source = 'ingest/auth/refresh'

export default async (req: Request, res: Response) => {
	try {
		let login: Awaited<{
			user: JwtPayload | string | null
			login: any
		}>

		// swap previously received refresh token for new id token
		try {
			login = await firebase.refreshToken(
				req.body.refreshToken
			)
		} catch (_error) {
			return response.badRequest(req, res, { status: 500 })
		}

		// return ok
		const expiresIn = Number.parseInt(login.login.expires_in)
		return response.ok(req, res, {
			expiresIn,
			expires: DateTime.now()
				.plus({ seconds: expiresIn })
				.toISO(),

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

		return response.internalServerError(req, res, error)
	}
}
