import type { Context } from 'hono'
import type { AuthUser } from '#types'
import logger from '@frytg/logger'
import { badRequest } from '../bad-request.ts'

const source = 'utils.response.errors.expiredStartTime'

/**
 * Respond when the event start time is too far in the past.
 * @param c - Hono context
 * @param body - Request body containing `start`
 * @returns Hono bad-request response
 */
export const errorsExpiredStartTime = (c: Context, body: { start?: string }) => {
	const user = c.get('user') as AuthUser | undefined
	logger.notice({
		message: `User attempted event with expired start time > ${body.start}`,
		source,
		data: {
			email: user?.email,
			body,
		},
	})

	return badRequest(c, {
		message: 'request.body.start should be recent',
		errors: [
			{
				path: '.body.start',
				message: 'should not be expired event',
				errorCode: 'required.openapi.validation',
			},
		],
	})
}
