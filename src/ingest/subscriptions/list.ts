import type { Context } from 'hono'
import type { AuthUser } from '#types'
import logger from '@frytg/logger'
import { getSafeHeaders } from '../../utils/get-safe-headers.ts'
import { getSubscriptions } from '../../utils/pubsub/get-subscriptions.ts'
import { responseInternalServerError } from '../../utils/response/internal-server-error.ts'

const source = 'ingest/subscriptions/list'

/**
 * List subscriptions for the authenticated user's institution.
 * @param c - Hono context
 * @returns Subscription list
 */
export const subscriptionsList = async (c: Context) => {
	try {
		const user = c.get('user') as AuthUser | undefined
		// check if user is present
		if (!user) {
			logger.notice({ message: 'user not found', source, data: getSafeHeaders(c.req.raw.headers) })
			return responseInternalServerError(c, new Error('User not found'))
		}

		// check if a user has an institutionId
		const institutionId = user.institutionId
		if (!institutionId) {
			logger.notice({
				message: `institutionId not found > ${user.email}`,
				source,
				data: getSafeHeaders(c.req.raw.headers),
			})
			return responseInternalServerError(c, new Error('User not found'))
		}

		// load all subscriptions
		let subscriptions = await getSubscriptions()

		// verify if user is allowed to list subscriptions (same institution)
		subscriptions = subscriptions.filter((subscription) => subscription?.institutionId === institutionId)

		return c.json(subscriptions, 200)
	} catch (error) {
		logger.error({
			message: 'failed to list subscriptions',
			source,
			error,
		})

		return responseInternalServerError(c, error as Error)
	}
}
