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

const source = 'ingest/subscriptions/get'

export default async (req: UserTokenRequest, res: Response) => {
	try {
		// preset vars
		const { subscriptionName } = req.params
		let limitedSubscription : {
			type: string;
			method: string;
			name: any;
			path: string | null | undefined;
			topic: { id: string; name: any; path: any };
			ackDeadlineSeconds: any;
			retryPolicy: any;
			serviceAccount: any;
			url: any;
			contact: any;
			institutionId: any
		}

		// load single subscription
		try {
			const subscription = await pubsub.getSubscription(subscriptionName)
			limitedSubscription = subscription.limited
		} catch (_error) {
			return response.notFound(req, res, {
				status: 404,
				message: `Subscription '${subscriptionName}' not found`,
			})
		}

		// verify if user is allowed to get subscription (same institution)
		if (limitedSubscription.institutionId !== req.user.institutionId) {
			const userInstitution = req.user.institutionId

			// return 400 error
			return response.badRequest(req, res, {
				status: 400,
				message: 'Mismatch of user and subscription institution',
				errors: `Subscription of this institution is not visible for user of institution '${userInstitution}'`,
			})
		}

		// return data
		return res.status(200).json(limitedSubscription)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to get subscription',
			source,
			error,
			data: { params: req.params },
		})

		return response.internalServerError(req, res, error)
	}
}
