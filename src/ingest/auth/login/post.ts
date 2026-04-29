/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Request, Response } from 'express'
import type { JwtPayload } from 'jsonwebtoken'
import { DateTime } from 'luxon'

import firebaseSignIn from '../../../utils/firebase/signInWithEmailAndPassword'
import responseOk from '../../../utils/response/ok.ts'
import responseBadRequest from '../../../utils/response/badRequest.ts'
import responseInternalServerError from '../../../utils/response/internalServerError.ts'

const source = 'ingest/auth/login'

export default async (req: Request, res: Response) => {
	try {
		let login: Awaited<{ user: JwtPayload | string | null; login: any }>

		// send email + password for verification, receive login and user object
		try {
			login = await firebaseSignIn(req.body.email, req.body.password)
		} catch (_error) {
			return responseBadRequest(req, res, { status: 500 })
		}

		// return ok
		const expiresIn = Number.parseInt(login.login.expiresIn, 10)
		return responseOk(req, res, {
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
			data: { headers: req.headers },
		})

		return responseInternalServerError(req, res, error as Error)
	}
}
