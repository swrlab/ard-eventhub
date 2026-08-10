import type { Context } from 'hono'
import type { AppVariables, ArdLivestream, AuthUser, EventhubSubscriptionDatastore } from '#types'
import type { SubscriptionPost } from '../../schemas/subscriptions.ts'
import { DateTime } from '@frytg/dates'
import logger from '@frytg/logger'
import { ulid } from 'ulid'
import { pubSubPrefix } from '#config'
import { stage } from '#env'
import { ardFeed } from '../../data/index.ts'
import datastoreSave from '../../utils/datastore/save.ts'
import pubsubBuildId from '../../utils/pubsub/buildId.ts'
import pubsubCreateSubscription from '../../utils/pubsub/createSubscription.ts'
import pubsubGetTopic from '../../utils/pubsub/getTopic.ts'
import responseBadRequest from '../../utils/response/badRequest.ts'
import responseInternalServerError from '../../utils/response/internalServerError.ts'
import responseNotFound from '../../utils/response/notFound.ts'
import { getValidatedBody } from '../../utils/validation/zod-validate.ts'

const source = 'ingest/subscriptions/post'

/**
 * Create a new push subscription for the authenticated user.
 * @param c - Hono context
 * @returns Created subscription
 */
export default async (c: Context<{ Variables: AppVariables }>) => {
	const body = getValidatedBody<SubscriptionPost>(c)
	try {
		// fetch user from request
		const user = c.get('user') as AuthUser | undefined

		// check if user is present
		if (!user?.email) {
			logger.log({
				level: 'notice',
				message: 'user not found',
				source,
				data: {
					...Object.fromEntries(c.req.raw.headers),
					authorization: 'hidden',
				},
			})
			return responseInternalServerError(c, new Error('User not found'))
		}

		// generate subscription name
		const prefix = `${pubSubPrefix}subscription.`

		// check existence of user institution
		const institutionExists = ardFeed?.items?.some((entry: ArdLivestream) => {
			return user.institutionId === entry.publisher.institution.id
		})

		// check if user has institution set
		if (!institutionExists) {
			const institutionId = user.institution?.id
			const institutionName = user.institution?.name

			// log action
			logger.log({
				level: 'warning',
				message: 'user attempted to create subscription without institution',
				source,
				data: {
					topic: body.topic,
					stage: stage,
					email: user.email,
					institutionExists,
					userInstitution: user.institution,
				},
			})

			// return 401 error
			return responseBadRequest(c, {
				status: 401,
				message: `New subscriptions are not allowed for user '${user.email}'`,
				errors: `The institution '${institutionId}' (${institutionName}) wasn't found in ARD Core-API`,
			})
		}

		// check if there is an invalid url

		if (!body.url) {
			// return 422 error
			return responseBadRequest(c, {
				status: 422,
				message: 'The URL in the body is missing',
				errors: 'The URL in the body is missing',
			})
		}

		const url: URL = new URL(body.url)

		// localhost check
		if (url.hostname.startsWith('localhost')) {
			// return 422 error
			return responseBadRequest(c, {
				status: 422,
				message: 'An invalid URL was sent for the subscription',
				errors: `A localhost URL was sent ('${url}') which is not allowed`,
			})
		}

		// ip address check
		if (url.hostname.match('([\\d]{1,3}\\.[\\d]{1,3}\\.[\\d]{1,3}\\.[\\d]{1,3})') !== null) {
			// return 422 error
			return responseBadRequest(c, {
				status: 422,
				message: 'An invalid URL was sent for the subscription',
				errors: 'IP addresses are not valid urls',
			})
		}

		if (url.protocol !== 'https:') {
			// return 422 error
			return responseBadRequest(c, {
				status: 422,
				message: 'An invalid URL was sent for the subscription',
				errors: "The URL isn't a secure website please send one that starts with https",
			})
		}

		// map inputs
		const subscriptionInputData: EventhubSubscriptionDatastore = {
			name: `${prefix}${ulid()}`,
			type: body.type,
			method: body.method,
			url: body.url,
			contact: body.contact,
			topic: pubsubBuildId(body.topic),

			creator: user.email,
			institutionId: user.institutionId as string,
			created: DateTime.now().toISO(),
		}

		// check existence of topic
		try {
			await pubsubGetTopic(subscriptionInputData.topic)
		} catch (error) {
			// log error
			logger.log({
				level: 'warning',
				message: `failed to find desired topic > ${subscriptionInputData.topic}`,
				source,
				error,
				data: { subscription: subscriptionInputData },
			})

			// return 404 error
			return responseNotFound(c, {
				status: 404,
				message: `Topic '${subscriptionInputData.topic}' not found`,
			})
		}

		// save to datastore
		const subscriptionId = await datastoreSave(subscriptionInputData, 'subscriptions')

		const subscription = { ...subscriptionInputData, id: subscriptionId }

		// request creation of subscription
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
