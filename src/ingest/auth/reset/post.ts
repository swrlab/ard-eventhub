/*

	ard-eventhub
	by SWR Audio Lab

*/

import { Request, Response } from 'express'

// load eventhub utils
import firebase from '../../../utils/firebase'
import logger from '../../../utils/logger'
import response from '../../../utils/response'

const source = 'ingest/auth/reset'

export default async (req: Request, res: Response) => {
	try {
		// try to reset email (may fail if not found)
		try {
			await firebase.sendPasswordResetEmail(req.body.email)
		} catch (error) {
			logger.log({
				level: 'notice',
				message: 'failed resetting password',
				source,
				error,
				data: { email: req.body.email },
			})

			return response.badRequest(req, res, { status: 500 })
		}

		// return ok
		return response.ok(req, res, { valid: true })
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to reset password',
			source,
			error,
			data: { body: req.body, headers: req.headers },
		})

		return response.internalServerError(req, res, error)
	}
}
