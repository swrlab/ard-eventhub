import type { Context } from 'hono'
import type { AuthUser } from '#types'
import type { EventhubSubscriptionWithLabels } from '../../schemas/subscriptions.ts'
import logger from '@frytg/logger'
import { datastoreDelete } from '../../utils/datastore/delete.ts'
import { deleteSubscription } from '../../utils/pubsub/delete-subscription.ts'
import { getSubscription } from '../../utils/pubsub/get-subscription.ts'
import { isCode5Error } from '../../utils/pubsub/publish-message.ts'
import { badRequest as responseBadRequest } from '../../utils/response/bad-request.ts'
import { responseInternalServerError } from '../../utils/response/internal-server-error.ts'
import { responseNotFound } from '../../utils/response/not-found.ts'
import { responseOk } from '../../utils/response/ok.ts'

const source = 'ingest/subscriptions/delete'

/**
 * Delete a subscription owned by the authenticated user's institution.
 * @param c - Hono context
 * @returns Deletion confirmation
 */
export const subscriptionsDelete = async (c: Context) => {
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

			if (isCode5Error(error)) {
				// pubsub error code 5 seems to be 'Resource not found'
				return responseNotFound(c, {
					status: 404,
					message: `Subscription '${subscriptionName}' not found`,
				})
			}

			// return generic error
			return responseBadRequest(c, {
				status: 500,
				message: 'Error while loading desired subscription',
			})
		}

		// check subscription permission by user institution
		if (fullSubscription.institutionId !== user.institutionId) {
			const userInstitution = user.institutionId

			// return 400 error
			return responseBadRequest(c, {
				status: 400,
				message: 'Mismatch of user and subscription institution',
				errors: `Subscription of this institution cannot be deleted by user of institution '${userInstitution}'`,
			})
		}

		if (!fullSubscription.labels?.id) {
			throw new Error('The label id is missing in the subscriptions.')
		}

		// request actual deletion
		await deleteSubscription(subscriptionName)

		// also delete from datastore
		const subscriptionId = Number.parseInt(fullSubscription.labels.id, 10)
		await datastoreDelete('subscriptions', subscriptionId.toString())

		logger.log({
			level: 'info',
			message: 'removed subscription',
			source,
			data: {
				email: user.email,
				subscriptionName,
				subscriptionId,
				fullSubscription,
			},
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
