/*

	ard-eventhub
	by SWR Audio Lab

*/

// load eventhub utils
import logger from '../../utils/logger'
import pubsub from '../../utils/pubsub'
import response from '../../utils/response'

import { Response } from 'express'
import UserTokenRequest from '@/src/ingest/auth/middleware/userTokenRequest.ts'

const source = 'ingest/subscriptions/list'

export default async (req: UserTokenRequest, res: Response) => {
	try {
		// load all subscriptions
		let subscriptions = await pubsub.getSubscriptions()

		// verify if user is allowed to list subscriptions (same institution)
		subscriptions = subscriptions.filter(
			(subscription: any) =>
				subscription?.institutionId ===
				req.user.institutionId
		)

		// return data
		return res.status(200).json(subscriptions)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to list subscriptions',
			source,
			error,
			data: {},
		})

		return response.internalServerError(req, res, error)
	}
}
