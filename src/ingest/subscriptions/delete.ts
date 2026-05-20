/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Response } from 'express'

import type UserTokenRequest from '@/src/ingest/auth/middleware/userTokenRequest.ts'
import type { EventhubSubscriptionWithLabels } from '@/types.eventhub.ts'
import datastoreDelete from '../../utils/datastore/delete.ts'
import deleteSubscription from '../../utils/pubsub/deleteSubscription.ts'
import getSubscription from '../../utils/pubsub/getSubscription.ts'
import responseOk from '../../utils/response/ok.ts'
import responseBadRequest from '../../utils/response/badRequest.ts'
import responseInternalServerError from '../../utils/response/internalServerError.ts'
import responseNotFound from '../../utils/response/notFound.ts'

const source = 'ingest/subscriptions/delete'

export default async (req: UserTokenRequest, res: Response) => {
	try {
		// preset vars
		const { subscriptionName } = req.params

		// check if subscription name is present
		if (!subscriptionName) {
			return responseBadRequest(req, res, { status: 400, message: 'Subscription name is required' })
		}

		// check if user is present
		if (!req.user) {
			return responseBadRequest(req, res, { status: 401, message: 'User not found' })
		}

		// load single subscription to get owner
		let fullSubscription: EventhubSubscriptionWithLabels
		try {
			const subscription = await getSubscription(subscriptionName)
			fullSubscription = subscription.full
		} catch (error) {
			logger.log({
				level: 'error',
				message: 'failed to find topic to be deleted',
				source,
				error,
				data: { subscriptionName },
			})

			if (error.code === 5) {
				// pubsub error code 5 seems to be 'Resource not found'
				return responseNotFound(req, res, {
					status: 404,
					message: `Subscription '${subscriptionName}' not found`,
				})
			}

			// return generic error
			return responseBadRequest(req, res, {
				status: 500,
				message: 'Error while loading desired subscription',
			})
		}

		// check subscription permission by user institution
		if (fullSubscription.institutionId !== req.user.institutionId) {
			const userInstitution = req.user.institutionId

			// return 400 error
			return responseBadRequest(req, res, {
				status: 400,
				message: 'Mismatch of user and subscription institution',
				errors: `Subscription of this institution cannot be deleted by user of institution '${userInstitution}'`,
			})
		}

		// request actual deletion
		await deleteSubscription(subscriptionName)

		// also delete from datastore
		const subscriptionId = Number.parseInt(fullSubscription.labels.id, 10)
		await datastoreDelete('subscriptions', subscriptionId.toString())

		// log progress
		logger.log({
			level: 'info',
			message: 'removed subscription',
			source,
			data: { email: req.user.email, subscriptionName, subscriptionId, fullSubscription },
		})

		// return data
		return responseOk(req, res, { valid: true })
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to delete subscription',
			source,
			error,
			data: { params: req.params },
		})

		return responseInternalServerError(req, res, error as Error)
	}
}
