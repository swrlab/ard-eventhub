import type { Request, Response } from '#types'
import logger from '@frytg/logger'
import pubsubGetTopics from '../../utils/pubsub/getTopics.ts'
import responseInternalServerError from '../../utils/response/internalServerError.ts'

const source = 'ingest/topics/list'

export default async (req: Request, res: Response) => {
	try {
		const topics = await pubsubGetTopics()
		return res.status(200).json(topics)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to list topics',
			source,
			error,
		})

		return responseInternalServerError(req, res, error as Error)
	}
}
