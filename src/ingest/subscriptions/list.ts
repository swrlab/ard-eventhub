import type { Context } from 'hono'
import type { AppVariables, AuthUser } from '#types'
import logger from '@frytg/logger'
import getSubscriptions from '../../utils/pubsub/getSubscriptions.ts'
import responseInternalServerError from '../../utils/response/internalServerError.ts'

const source = 'ingest/subscriptions/list'

/**
 * List subscriptions for the authenticated user's institution.
 * @param c - Hono context
 * @returns Subscription list
 */
export default async (c: Context<{ Variables: AppVariables }>) => {
	try {
		const user = c.get('user') as AuthUser | undefined
		// check if user is present
		if (!user) {
			logger.log({
				level: 'notice',
				message: 'user not found',
				source,
				data: {
					...Object.fromEntries(c.req.raw.headers),
					authorization: 'hidden',
				},
			})
			return responseInternalServerError(c, new Error('User not found'))
		}

		// check if a user has an institutionId
		const institutionId = user.institutionId
		if (!institutionId) {
			logger.log({
				level: 'notice',
				message: `institutionId not found for user > ${user.email}`,
				source,
				data: {
					...Object.fromEntries(c.req.raw.headers),
					authorization: 'hidden',
				},
			})
			return responseInternalServerError(c, new Error('User not found'))
		}

		// load all subscriptions
		let subscriptions = await getSubscriptions()

		// verify if user is allowed to list subscriptions (same institution)
		subscriptions = subscriptions.filter((subscription) => subscription?.institutionId === institutionId)

		return c.json(subscriptions, 200)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to list subscriptions',
			source,
			error,
		})

		return responseInternalServerError(c, error as Error)
	}
}
