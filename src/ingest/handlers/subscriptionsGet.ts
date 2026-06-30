/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Context } from 'hono'

import type { AppVariables } from '@/src/ingest/types.ts'
import type { EventhubSubscriptionLimited } from '@/types.eventhub.ts'
import getSubscription from '@/src/utils/pubsub/getSubscription.ts'
import responseNotFound from '@/src/utils/response/notFound.ts'
import responseBadRequest from '@/src/utils/response/badRequest.ts'
import responseInternalServerError from '@/src/utils/response/internalServerError.ts'

const source = 'ingest/subscriptions/get'

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

		let limitedSubscription: EventhubSubscriptionLimited
		try {
			const subscription = await getSubscription(subscriptionName)
			limitedSubscription = subscription.limited
		} catch (_error) {
			return responseNotFound(c, {
				status: 404,
				message: `Subscription '${subscriptionName}' not found`,
			})
		}

		if (limitedSubscription.institutionId !== user.institutionId) {
			const userInstitution = user.institutionId

			return responseBadRequest(c, {
				status: 400,
				message: 'Mismatch of user and subscription institution',
				errors: `Subscription of this institution is not visible for user of institution '${userInstitution}'`,
			})
		}

		return c.json(limitedSubscription, 200)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to get subscription',
			source,
			error,
			data: { params: c.req.param() },
		})

		return responseInternalServerError(c, error as Error)
	}
}
