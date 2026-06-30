/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Context } from 'hono'

import pubsubGetTopics from '@/src/utils/pubsub/getTopics.ts'
import responseInternalServerError from '@/src/utils/response/internalServerError.ts'

const source = 'ingest/topics/list'

export default async (c: Context) => {
	try {
		const topics = await pubsubGetTopics()

		return c.json(topics, 200)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to list topics',
			source,
			error,
		})

		return responseInternalServerError(c, error as Error)
	}
}
