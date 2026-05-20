/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Request, Response } from 'express'

import firebaseSendPasswordResetEmail from '../../../utils/firebase/sendPasswordResetEmail.ts'

import responseOk from '../../../utils/response/ok.ts'
import responseBadRequest from '../../../utils/response/badRequest.ts'
import responseInternalServerError from '../../../utils/response/internalServerError.ts'

const source = 'ingest/auth/reset'

export default async (req: Request, res: Response) => {
	try {
		// try to reset email (may fail if not found)
		try {
			await firebaseSendPasswordResetEmail(req.body.email)
		} catch (error) {
			logger.log({
				level: 'notice',
				message: 'failed resetting password',
				source,
				error,
				data: { email: req.body.email },
			})

			return responseBadRequest(req, res, { status: 500 })
		}

		// return ok
		return responseOk(req, res, { valid: true })
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to reset password',
			source,
			error,
			data: { body: req.body, headers: req.headers },
		})

		return responseInternalServerError(req, res, error as Error)
	}
}
