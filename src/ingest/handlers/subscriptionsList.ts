/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Context } from 'hono'

import type { AppVariables } from '@/src/ingest/types.ts'
import getSubscriptions from '@/src/utils/pubsub/getSubscriptions.ts'
import responseInternalServerError from '@/src/utils/response/internalServerError.ts'

const source = 'ingest/subscriptions/list'

export default async (c: Context<{ Variables: AppVariables }>) => {
	try {
		if (!c.get('user')) {
			logger.log({
				level: 'notice',
				message: 'user not found',
				source,
				data: { ...Object.fromEntries(c.req.raw.headers), authorization: 'hidden' },
			})
			return responseInternalServerError(c, new Error('User not found'))
		}

		let subscriptions = await getSubscriptions()
		subscriptions = subscriptions.filter((subscription) => subscription?.institutionId === c.get('user')?.institutionId)

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
