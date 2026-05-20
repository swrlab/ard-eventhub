/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Request, Response } from 'express'

import pubsubGetTopics from '../../utils/pubsub/getTopics'
import responseInternalServerError from '../../utils/response/internalServerError'

const source = 'ingest/topics/list'

export default async (req: Request, res: Response) => {
	try {
		// load all topics
		const topics = await pubsubGetTopics()

		// return data
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
