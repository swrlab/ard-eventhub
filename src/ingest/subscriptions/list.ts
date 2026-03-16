import logger from '@frytg/logger'
import type { Response, UserTokenRequest } from '#types'
import getSubscriptions from '../../utils/pubsub/getSubscriptions.ts'
import response from '../../utils/response/index.ts'

const source = 'ingest/subscriptions/list'

export default async (req: UserTokenRequest, res: Response) => {
	try {
		// check if user is present
		if (!req.user) {
			logger.log({
				level: 'notice',
				message: 'user not found',
				source,
				data: {
					...req.headers,
					authorization: 'hidden',
				},
			})
			return response.internalServerError(req, res, new Error('User not found'))
		}

		// check if a user has an institutionId
		const institutionId = req.user.institutionId
		if (!institutionId) {
			logger.log({
				level: 'notice',
				message: `institutionId not found for user > ${req.user.email}`,
				source,
				data: {
					...req.headers,
					authorization: 'hidden',
				},
			})
			return response.internalServerError(req, res, new Error('User not found'))
		}

		// load all subscriptions
		let subscriptions = await getSubscriptions()

		// verify if user is allowed to list subscriptions (same institution)
		subscriptions = subscriptions.filter((subscription) => subscription?.institutionId === institutionId)

		return res.status(200).json(subscriptions)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to list subscriptions',
			source,
			error,
		})

		return response.internalServerError(req, res, error as Error)
	}
}
