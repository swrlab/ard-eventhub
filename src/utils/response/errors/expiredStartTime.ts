/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Response } from 'express'

import type UserTokenRequest from '@/src/ingest/auth/middleware/userTokenRequest.ts'
import badRequest from '../badRequest.ts'

const source = 'utils.response.errors.expiredStartTime'

export default (req: UserTokenRequest, res: Response) => {
	// log access attempt
	logger.log({
		level: 'notice',
		message: `User attempted event with expired start time > ${req.body.start}`,
		source,
		data: {
			email: req.user.email,
			body: req.body,
		},
	})

	// return 400
	return badRequest(req, res, {
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
