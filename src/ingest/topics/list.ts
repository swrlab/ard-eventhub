import type { Context } from 'hono'
import logger from '@frytg/logger'
import pubsubGetTopics from '../../utils/pubsub/getTopics.ts'
import responseInternalServerError from '../../utils/response/internalServerError.ts'

const source = 'ingest/topics/list'

/**
 * List all available Pub/Sub topics.
 * @param c - Hono context
 * @returns Topics array
 */
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
