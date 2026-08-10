import type { Context } from 'hono'
import type { AuthUser } from '#types'
import type { EventhubSubscriptionLimited } from '../../schemas/subscriptions.ts'
import logger from '@frytg/logger'
import { getSubscription } from '../../utils/pubsub/get-subscription.ts'
import { badRequest as responseBadRequest } from '../../utils/response/bad-request.ts'
import { responseInternalServerError } from '../../utils/response/internal-server-error.ts'
import { responseNotFound } from '../../utils/response/not-found.ts'

const source = 'ingest/subscriptions/get'

/**
 * Get a single subscription by name for the authenticated user.
 * @param c - Hono context
 * @returns Limited subscription object
 */
export const subscriptionsGet = async (c: Context) => {
	try {
		// preset vars
		const subscriptionName = c.req.param('subscriptionName')

		// check if subscription name is present
		if (!subscriptionName) {
			return responseBadRequest(c, { status: 400, message: 'Subscription name is required' })
		}

		const user = c.get('user') as AuthUser | undefined
		// check if user is present
		if (!user) {
			return responseBadRequest(c, { status: 401, message: 'User not found' })
		}

		// load single subscription
		let limitedSubscription: EventhubSubscriptionLimited
		try {
			const subscription = await getSubscription(subscriptionName)
			limitedSubscription = subscription.limited
		} catch {
			return responseNotFound(c, {
				status: 404,
				message: `Subscription '${subscriptionName}' not found`,
			})
		}

		// verify if user is allowed to get subscription (same institution)
		if (limitedSubscription.institutionId !== user.institutionId) {
			const userInstitution = user.institutionId

			// return 400 error
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
