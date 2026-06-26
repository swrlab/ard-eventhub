/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Context } from 'hono'
import { DateTime } from 'luxon'
import { ulid } from 'ulid'

import type { AppVariables } from '@/src/ingest/types.ts'
import type { ArdLivestream } from '@/types.ard.ts'
import type { EventhubSubscriptionDatastore } from '@/types.eventhub.ts'
import config from '@/config/index.ts'
import { ardFeed } from '@/src/data/index.ts'
import datastoreSave from '@/src/utils/datastore/save.ts'
import pubsubBuildId from '@/src/utils/pubsub/buildId.ts'
import pubsubGetTopic from '@/src/utils/pubsub/getTopic.ts'
import pubsubCreateSubscription from '@/src/utils/pubsub/createSubscription.ts'
import responseNotFound from '@/src/utils/response/notFound.ts'
import responseBadRequest from '@/src/utils/response/badRequest.ts'
import responseInternalServerError from '@/src/utils/response/internalServerError.ts'
import type { subscriptionPostSchema } from '@/src/ingest/schemas/subscriptions.ts'
import type * as z from 'zod'

const source = 'ingest/subscriptions/post'

type SubscriptionPostBody = z.infer<typeof subscriptionPostSchema>

export default async (c: Context<{ Variables: AppVariables }>, body: SubscriptionPostBody) => {
	try {
		const user = c.get('user')

		if (!user?.email) {
			logger.log({
				level: 'notice',
				message: 'user not found',
				source,
				data: { ...Object.fromEntries(c.req.raw.headers), authorization: 'hidden' },
			})
			return responseInternalServerError(c, new Error('User not found'))
		}

		const prefix = `${config.pubSubPrefix}subscription.`
		const institutionExists = ardFeed?.items?.some((entry: ArdLivestream) => {
			return user.institutionId === entry.publisher.institution.id
		})

		if (!institutionExists) {
			const institutionId = user.institution?.id
			const institutionName = user.institution?.name

			logger.log({
				level: 'warning',
				message: 'user attempted to create subscription without institution',
				source,
				data: {
					topic: body.topic,
					stage: config.stage,
					email: user.email,
					institutionExists,
					userInstitution: user.institution,
				},
			})

			return responseBadRequest(c, {
				status: 401,
				message: `New subscriptions are not allowed for user '${user.email}'`,
				errors: `The institution '${institutionId}' (${institutionName}) wasn't found in ARD Core-API`,
			})
		}

		if (!body.url) {
			return responseBadRequest(c, {
				status: 422,
				message: 'The URL in the body is missing',
				errors: 'The URL in the body is missing',
			})
		}

		const url: URL = new URL(body.url)

		if (url.hostname.startsWith('localhost')) {
			return responseBadRequest(c, {
				status: 422,
				message: 'An invalid URL was sent for the subscription',
				errors: `A localhost URL was sent ('${url}') which is not allowed`,
			})
		}

		if (url.hostname.match('([\\d]{1,3}\\.[\\d]{1,3}\\.[\\d]{1,3}\\.[\\d]{1,3})') != null) {
			return responseBadRequest(c, {
				status: 422,
				message: 'An invalid URL was sent for the subscription',
				errors: 'IP addresses are not valid urls',
			})
		}

		if (url.protocol !== 'https:') {
			return responseBadRequest(c, {
				status: 422,
				message: 'An invalid URL was sent for the subscription',
				errors: "The URL isn't a secure website please send one that starts with https",
			})
		}

		let subscription: EventhubSubscriptionDatastore = {
			id: undefined,
			name: `${prefix}${ulid()}`,
			type: body.type,
			method: body.method,
			url: body.url,
			contact: body.contact,
			topic: pubsubBuildId(body.topic),
			creator: user.email,
			institutionId: user.institutionId,
			created: DateTime.now().toISO(),
		}

		try {
			await pubsubGetTopic(subscription.topic)
		} catch (error) {
			logger.log({
				level: 'warning',
				message: `failed to find desired topic > ${subscription.topic}`,
				source,
				error,
				data: { subscription },
			})

			return responseNotFound(c, {
				status: 404,
				message: `Topic '${subscription.topic}' not found`,
			})
		}

		subscription = await datastoreSave(subscription, 'subscriptions', null)

		if (!subscription.id) {
			logger.log({
				level: 'error',
				message: 'failed to save subscription to datastore',
				source,
				data: { subscription },
			})
			return responseInternalServerError(c, new Error('Failed to save subscription'))
		}

		const createdSubscription = await pubsubCreateSubscription(subscription)

		return c.json(createdSubscription, 201)
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to create subscription',
			source,
			error,
			data: { body },
		})

		return responseInternalServerError(c, error as Error)
	}
}
