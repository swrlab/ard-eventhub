/*

	ard-eventhub
	by SWR Audio Lab

*/
import type { Request, Response } from 'express'
import logger from '../../utils/logger'
import pubsub from '../../utils/pubsub'
import response from '../../utils/response'

const source = 'ingest/topics/list'

export default async (req: Request, res: Response) => {
	try {
		// load all topics
		const topics = await pubsub.getTopics()

		// return data
		return res.status(200).json(topics)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to list topics',
			source,
			error,
			data: {},
		})

		return response.internalServerError(req, res, error)
	}
}
