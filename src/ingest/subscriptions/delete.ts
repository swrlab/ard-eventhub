/*

	ard-eventhub
	by SWR Audio Lab

*/

import type { Response } from 'express'
import type UserTokenRequest from '@/src/ingest/auth/middleware/userTokenRequest.ts'

import datastore from '../../utils/datastore'
import logger from '../../utils/logger'
import pubsub from '../../utils/pubsub'
import response from '../../utils/response'

const source = 'ingest/subscriptions/delete'

export default async (req: UserTokenRequest, res: Response) => {
	try {
		// preset vars
		const { subscriptionName } = req.params
		let fullSubscription: {
			labels: any
			type: string
			method: string
			name: string | undefined
			path: string | null | undefined
			topic: {
				id: string
				name: any
				path: any
			}
			ackDeadlineSeconds: any
			retryPolicy: any
			serviceAccount: any
			url: any
			contact: any
			institutionId: any
		}

		// load single subscription to get owner
		try {
			const subscription = await pubsub.getSubscription(subscriptionName)
			fullSubscription = subscription.full
		} catch (error: any) {
			logger.log({
				level: 'error',
				message: 'failed to find topic to be deleted',
				source,
				error,
				data: { subscriptionName },
			})

			if (error.code === 5) {
				// pubsub error code 5 seems to be 'Resource not found'
				return response.notFound(req, res, {
					status: 404,
					message: `Subscription '${subscriptionName}' not found`,
				})
			}

			// return generic error
			return response.badRequest(req, res, {
				status: 500,
				message: 'Error while loading desired subscription',
			})
		}

		// check subscription permission by user institution
		if (fullSubscription.institutionId !== req.user.institutionId) {
			const userInstitution = req.user.institutionId

			// return 400 error
			return response.badRequest(req, res, {
				status: 400,
				message: 'Mismatch of user and subscription institution',
				errors: `Subscription of this institution cannot be deleted by user of institution '${userInstitution}'`,
			})
		}

		// request actual deletion
		await pubsub.deleteSubscription(subscriptionName)

		// also delete from datastore
		const subscriptionId = Number.parseInt(fullSubscription.labels.id, 10)
		await datastore.delete('subscriptions', subscriptionId.toString())

		// log progress
		logger.log({
			level: 'info',
			message: 'removed subscription',
			source,
			data: {
				email: req.user.email,
				subscriptionName,
				subscriptionId,
				fullSubscription,
			},
		})

		// return data
		return response.ok(req, res, {
			valid: true,
		})
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'failed to delete subscription',
			source,
			error,
			data: { params: req.params },
		})

		return response.internalServerError(req, res, error)
	}
}
