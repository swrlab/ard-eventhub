/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Context } from 'hono'

import type { AppVariables } from '@/src/ingest/types.ts'
import type { EventhubSubscriptionWithLabels } from '@/types.eventhub.ts'
import datastoreDelete from '@/src/utils/datastore/delete.ts'
import deleteSubscription from '@/src/utils/pubsub/deleteSubscription.ts'
import getSubscription from '@/src/utils/pubsub/getSubscription.ts'
import responseOk from '@/src/utils/response/ok.ts'
import responseBadRequest from '@/src/utils/response/badRequest.ts'
import responseInternalServerError from '@/src/utils/response/internalServerError.ts'
import responseNotFound from '@/src/utils/response/notFound.ts'

const source = 'ingest/subscriptions/delete'

export default async (c: Context<{ Variables: AppVariables }>) => {
	try {
		const subscriptionName = c.req.param('subscriptionName')

		if (!subscriptionName) {
			return responseBadRequest(c, { status: 400, message: 'Subscription name is required' })
		}

		const user = c.get('user')
		if (!user) {
			return responseBadRequest(c, { status: 401, message: 'User not found' })
		}

		let fullSubscription: EventhubSubscriptionWithLabels
		try {
			const subscription = await getSubscription(subscriptionName)
			fullSubscription = subscription.full
		} catch (error: any) {
			logger.log({
				level: 'error',
				message: 'failed to find topic to be deleted',
				source,
				error,
				data: { subscriptionName },
			})

			if (error.code === 5) {
				return responseNotFound(c, {
					status: 404,
					message: `Subscription '${subscriptionName}' not found`,
				})
			}

			return responseBadRequest(c, {
				status: 500,
				message: 'Error while loading desired subscription',
			})
		}

		if (fullSubscription.institutionId !== user.institutionId) {
			const userInstitution = user.institutionId

			return responseBadRequest(c, {
				status: 400,
				message: 'Mismatch of user and subscription institution',
				errors: `Subscription of this institution cannot be deleted by user of institution '${userInstitution}'`,
			})
		}

		await deleteSubscription(subscriptionName)

		const subscriptionId = Number.parseInt(fullSubscription.labels.id, 10)
		await datastoreDelete('subscriptions', subscriptionId.toString())

		logger.log({
			level: 'info',
			message: 'removed subscription',
			source,
			data: { email: user.email, subscriptionName, subscriptionId, fullSubscription },
		})

		return responseOk(c, { valid: true })
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to delete subscription',
			source,
			error,
			data: { params: c.req.param() },
		})

		return responseInternalServerError(c, error as Error)
	}
}
