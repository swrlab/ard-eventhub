import logger from '@frytg/logger'
import type { Request, Response } from '#types'

import pubsub from '../../utils/pubsub/index.ts'
import { internalServerError } from '../../utils/response/index.ts'

const source = 'ingest/topics/list'

export default async (req: Request, res: Response) => {
	try {
		const topics = await pubsub.getTopics()
		return res.status(200).json(topics)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to list topics',
			source,
			error,
		})
		return internalServerError(req, res, error as Error)
	}
}
