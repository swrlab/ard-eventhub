import type { Context } from 'hono'
import type { AuthUser } from '#types'
import logger from '@frytg/logger'
import { badRequest } from '../bad-request.ts'

const source = 'utils.response.errors.mismatchingEventName'

/**
 * Respond when the event body name does not match the URL parameter.
 * @param c - Hono context
 * @param body - Request body used for logging
 * @returns Hono bad-request response
 */
export const errorsMismatchingEventName = (c: Context, body: unknown) => {
	const user = c.get('user') as AuthUser | undefined
	logger.warning({
		message: 'User attempted event with mismatching names',
		source,
		data: {
			email: user?.email,
			body,
			params: c.req.param(),
		},
	})

	return badRequest(c, {
		message: 'request.body.event should match URL parameter',
		errors: [
			{
				path: '.body.event',
				message: 'should match URL parameter',
				errorCode: 'required.openapi.validation',
			},
		],
	})
}
