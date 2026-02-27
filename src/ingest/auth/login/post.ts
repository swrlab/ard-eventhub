import { getNow } from '@frytg/dates'
import logger from '@frytg/logger'
import type { Request, Response } from 'express'
import type { JwtPayload } from 'jsonwebtoken'
import firebase from '../../../utils/firebase/index.ts'
import response from '../../../utils/response/index.ts'

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
			login = await firebase.signInWithEmailAndPassword(req.body.email, req.body.password)
		} catch {
			return response.badRequest(req, res, { status: 500, message: 'Could not login.' })
		}

		// return ok
		const expiresIn = Number.parseInt(login.login.expiresIn, 10)
		return response.ok(req, res, {
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

		return response.internalServerError(req, res, error as Error)
	}
}
