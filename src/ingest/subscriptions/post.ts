/*

	ard-eventhub
	by SWR Audio Lab

*/

// load node utils
import { DateTime } from 'luxon'
import { ulid } from 'ulid'

// load eventhub utils
import datastore from '../../utils/datastore'
import logger from '../../utils/logger'
import pubsub from '../../utils/pubsub'
import response from '../../utils/response'
import config from '../../../config'

import { Response } from 'express'
import UserTokenRequest from '@/src/ingest/auth/middleware/userTokenRequest.ts'

// load api feed (needed to get the file initialized)

const source = 'ingest/subscriptions/post'

export default async (req: UserTokenRequest, res: Response) => {
	try {
		// fetch user from request
		const user = req.user!!

		// generate subscription name
		const prefix = `${config.pubSubPrefix}subscription.`

		// check existence of user institution
		const ardFeed = import('../../data/ard-core-livestreams.json')

		const institutionExists = await ardFeed.then((feed) =>
			feed.items.some((entry: any) => {
				return (
					user.institutionId ===
					entry.publisher.institution.id
				)
			})
		)

		// check if user has institution set
		if (!institutionExists) {
			const institutionId = user.institution.id
			const institutionName = user.institution.name

			// log action
			logger.log({
				level: 'warning',
				message: 'user attempted to create subscription without institution',
				source,
				data: {
					topic: req.body.topic,
					stage: config.stage,
					email: user.email,
					institutionExists,
					userInstitution: user.institution,
				},
			})

			// return 401 error
			return response.badRequest(req, res, {
				status: 401,
				message: `New subscriptions are not allowed for user '${user.email}'`,
				errors: `The institution '${institutionId}' (${institutionName}) wasn't found in ARD Core-API`,
			})
		}

		// map inputs
		let subscription = {
			id: undefined as undefined | string,
			name: `${prefix}${ulid()}`,
			type: req.body.type,
			method: req.body.method,
			url: req.body.url,
			contact: req.body.contact,
			topic: pubsub.buildId(req.body.topic),

			creator: user.email,
			institutionId: user.institutionId,
			created: DateTime.now().toISO(),
		}

		// save to datastore
		subscription = await datastore.save(
			subscription,
			'subscriptions',
			null
		)

		// check existence of topic
		try {
			await pubsub.getTopic(subscription.topic)
		} catch (error) {
			// log error
			logger.log({
				level: 'warning',
				message: `failed to find desired topic > ${subscription.topic}`,
				source,
				error,
				data: { subscription },
			})

			// delete datastore object
			await datastore.delete('subscriptions', subscription.id!)

			// return 404 error
			return response.notFound(req, res, {
				status: 404,
				message: `Topic '${subscription.topic}' not found`,
			})
		}

		// request creation of subscription
		const createdSubscription =
			await pubsub.createSubscription(subscription)

		// return data
		return res.status(201).json(createdSubscription)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to create subscription',
			source,
			error,
			data: { body: req.body },
		})

		return response.internalServerError(req, res, error)
	}
}
