/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Context } from 'hono'

import type { AppVariables } from '@/src/ingest/types.ts'
import badRequest from '../badRequest.ts'

const source = 'utils.response.errors.expiredStartTime'

export default (c: Context<{ Variables: AppVariables }>, body: Record<string, unknown>) => {
	logger.log({
		level: 'notice',
		message: `User attempted event with expired start time > ${body.start}`,
		source,
		data: {
			email: c.get('user')?.email,
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
