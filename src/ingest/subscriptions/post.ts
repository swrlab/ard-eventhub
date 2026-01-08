/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Response } from 'express'
import { DateTime } from 'luxon'
import { ulid } from 'ulid'

import type UserTokenRequest from '@/src/ingest/auth/middleware/userTokenRequest.ts'
import type { ArdLivestream } from '@/types.ard.ts'
import type { EventhubSubscriptionDatastore } from '@/types.eventhub.ts'
import config from '../../../config'
import { ardFeed } from '../../data/index.ts'
import datastore from '../../utils/datastore'
import pubsub from '../../utils/pubsub'
import response from '../../utils/response'

const source = 'ingest/subscriptions/post'

export default async (req: UserTokenRequest, res: Response) => {
	try {
		// fetch user from request
		const user = req.user

		// check if user is present
		if (!user?.email) {
			logger.log({
				level: 'notice',
				message: 'user not found',
				source,
				data: { ...req.headers, authorization: 'hidden' },
			})
			return response.internalServerError(req, res, new Error('User not found'))
		}

		// generate subscription name
		const prefix = `${config.pubSubPrefix}subscription.`

		// check existence of user institution
		const institutionExists = ardFeed?.items?.some((entry: ArdLivestream) => {
			return user.institutionId === entry.publisher.institution.id
		})

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

		// check if there is an invalid url
		const url: string = req.body.url

		if (!url) {
			// return 422 error
			return response.badRequest(req, res, {
				status: 422,
				message: 'The URL in the body is missing',
				errors: 'The URL in the body is missing',
			})
		}

		// localhost check
		if (url.includes('localhost')) {
			// return 422 error
			return response.badRequest(req, res, {
				status: 422,
				message: 'An invalid URL was sent for the subscription',
				errors: `A localhost URL was sent ('${url}') which is not allowed`,
			})
		}

		// ip address check
		if (url.match('([\\d]{1,3}\\.[\\d]{1,3}\\.[\\d]{1,3}\\.[\\d]{1,3}):([\\d]{1,5})') != null
			|| url.match('([\\d]{1,3}\\.[\\d]{1,3}\\.[\\d]{1,3}\\.[\\d]{1,3})') != null) {
			// return 422 error
			return response.badRequest(req, res, {
				status: 422,
				message: 'An invalid URL was sent for the subscription',
				errors: 'IP adresses are not valid urls',
			})
		}


		if (!url.includes('ard')) {
			// return 422 error
			return response.badRequest(req, res, {
				status: 422,
				message: 'An invalid URL was sent for the subscription',
				errors: 'URL is not an ARD one',
			})
		}

		if (!url.includes('https')) {
			// return 422 error
			return response.badRequest(req, res, {
				status: 422,
				message: 'An invalid URL was sent for the subscription',
				errors: 'The URL isn\'t a secure website please send one that starts with https',
			})
		}

		// map inputs
		let subscription: EventhubSubscriptionDatastore = {
			id: undefined,
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

			// return 404 error
			return response.notFound(req, res, {
				status: 404,
				message: `Topic '${subscription.topic}' not found`,
			})
		}

		// save to datastore
		subscription = await datastore.save(subscription, 'subscriptions', null)

		// check if subscription was saved
		if (!subscription.id) {
			logger.log({
				level: 'error',
				message: 'failed to save subscription to datastore',
				source,
				data: { subscription },
			})
			return response.internalServerError(req, res, new Error('Failed to save subscription'))
		}

		// request creation of subscription
		const createdSubscription = await pubsub.createSubscription(subscription)

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

		return response.internalServerError(req, res, error as Error)
	}
}
