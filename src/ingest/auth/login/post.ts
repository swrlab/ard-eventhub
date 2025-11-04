/*

	ard-eventhub
	by SWR Audio Lab

*/

import type { Request, Response } from 'express'
import type { JwtPayload } from 'jsonwebtoken'
import { DateTime } from 'luxon'

import firebase from '../../../utils/firebase'
import logger from '../../../utils/logger'
import response from '../../../utils/response'

const source = 'ingest/auth/login'

export default async (req: Request, res: Response) => {
	try {
		let login: Awaited<{ user: JwtPayload | string | null; login: any }>

		// send email + password for verification, receive login and user object
		try {
			login = await firebase.signInWithEmailAndPassword(req.body.email, req.body.password)
		} catch (_error) {
			return response.badRequest(req, res, { status: 500 })
		}

		// return ok
		const expiresIn = Number.parseInt(login.login.expiresIn, 10)
		return response.ok(req, res, {
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

		return response.internalServerError(req, res, error)
	}
}
