import type { Context } from 'hono'
import type { AuthResetBody } from '../../schemas/auth.ts'
import { logger } from '@frytg/logger'
import { firebaseSendPasswordResetEmail } from '../../utils/firebase/send-password-reset-email.ts'
import { getSafeHeaders } from '../../utils/get-safe-headers.ts'
import { badRequest as responseBadRequest } from '../../utils/response/bad-request.ts'
import { responseInternalServerError } from '../../utils/response/internal-server-error.ts'
import { responseOk } from '../../utils/response/ok.ts'
import { getValidatedBody } from '../../utils/validation/zod-validate.ts'

const source = 'ingest/auth/reset'

/**
 * Request a password reset email.
 * @param c - Hono context
 * @returns Success payload
 */
export const authResetPost = async (c: Context) => {
	const body = getValidatedBody<AuthResetBody>(c)
	try {
		// try to reset email (may fail if not found)
		try {
			await firebaseSendPasswordResetEmail(body.email as string)
		} catch (error) {
			logger.notice({ message: 'failed resetting password', source, error, data: { email: body.email } })

			return responseBadRequest(c, { status: 500, message: 'Could not reset auth' })
		}

		// return ok
		return responseOk(c, { valid: true })
	} catch (error) {
		logger.error({
			message: 'failed to reset password',
			source,
			error,
			data: { body, headers: getSafeHeaders(c.req.raw.headers) },
		})

		return responseInternalServerError(c)
	}
}
