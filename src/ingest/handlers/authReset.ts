/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Context } from 'hono'

import firebaseSendPasswordResetEmail from '@/src/utils/firebase/sendPasswordResetEmail.ts'
import responseOk from '@/src/utils/response/ok.ts'
import responseBadRequest from '@/src/utils/response/badRequest.ts'
import responseInternalServerError from '@/src/utils/response/internalServerError.ts'
import type { authResetBodySchema } from '@/src/ingest/schemas/auth.ts'
import type * as z from 'zod'

const source = 'ingest/auth/reset'

type ResetBody = z.infer<typeof authResetBodySchema>

export default async (c: Context, body: ResetBody) => {
	try {
		try {
			await firebaseSendPasswordResetEmail(body.email)
		} catch (error) {
			logger.log({
				level: 'notice',
				message: 'failed resetting password',
				source,
				error,
				data: { email: body.email },
			})

			return responseBadRequest(c, { status: 500 })
		}

		return responseOk(c, { valid: true })
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to reset password',
			source,
			error,
			data: { body, headers: Object.fromEntries(c.req.raw.headers) },
		})

		return responseInternalServerError(c, error as Error)
	}
}
