/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Context } from 'hono'

import type { AppVariables } from '@/src/ingest/types.ts'
import badRequest from '../badRequest.ts'

const source = 'utils.response.errors.mismatchingEventName'

export default (c: Context<{ Variables: AppVariables }>, body: Record<string, unknown>) => {
	logger.log({
		level: 'warning',
		message: 'User attempted event with mismatching names',
		source,
		data: {
			email: c.get('user')?.email,
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
