import logger from '@frytg/logger'
import type { Response, UserTokenRequest } from '#types'
import badRequest from '../badRequest.ts'

const source = 'utils.response.errors.mismatchingEventName'

export default (req: UserTokenRequest, res: Response) => {
	logger.log({
		level: 'warning',
		message: 'User attempted event with mismatching names',
		source,
		data: {
			email: req.user?.email,
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
