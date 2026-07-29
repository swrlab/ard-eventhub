import { getNow } from '@frytg/dates'
import logger from '@frytg/logger'
import type { Request, Response } from 'express'
import type { JwtPayload } from 'jsonwebtoken'
import firebaseSignIn from '../../../utils/firebase/signInWithEmailAndPassword.ts'
import responseBadRequest from '../../../utils/response/badRequest.ts'
import responseInternalServerError from '../../../utils/response/internalServerError.ts'
import responseOk from '../../../utils/response/ok.ts'

const source = 'ingest/auth/login'

type Login = {
	expiresIn: string
	idToken: string
	refreshToken: string
}

export default async (req: Request, res: Response) => {
	try {
		let login: Awaited<{
			user: JwtPayload | string | null
			login: Login
		}>

		// send email + password for verification, receive login and user object
		try {
			login = await firebaseSignIn(req.body.email, req.body.password)
		} catch {
			return responseBadRequest(req, res, { status: 500, message: 'Could not login.' })
		}

		const expiresIn = Number.parseInt(login.login.expiresIn, 10)
		return responseOk(req, res, {
			expiresIn,
			expires: getNow().plus({ seconds: expiresIn }).toISO(),

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
