/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Response } from 'express'

import type UserTokenRequest from '@/src/ingest/auth/middleware/userTokenRequest.ts'
import badRequest from '../badRequest.ts'

const source = 'utils.response.errors.mismatchingEventName'

export default (req: UserTokenRequest, res: Response) => {
	// log access attempt
	logger.log({
		level: 'warning',
		message: 'User attempted event with mismatching names',
		source,
		data: {
			email: req.user.email,
			body: req.body,
			params: req.params,
		},
	})

	// return 400
	return badRequest(req, res, {
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
