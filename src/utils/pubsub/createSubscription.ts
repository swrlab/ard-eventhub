import logger from '@frytg/logger'
import { DateTime } from 'luxon'
import slug from 'slug'
import { projectId, stage } from '#env'
import type { EventhubSubscriptionDatastore, ISubscription } from '#types'
import pubSubSubscriberClient from './_subscriberClient.ts'
import mapSubscription from './mapSubscription.ts'

const source = 'utils/pubsub/createSubscription'

export default async (subscription: EventhubSubscriptionDatastore) => {
	// map inputs for pubsub
	const options: ISubscription = {
		name: `projects/${projectId}/subscriptions/${subscription.name}`,
		topic: `projects/${projectId}/topics/${subscription.topic}`,
		pushConfig: {
			pushEndpoint: subscription.url,
			oidcToken: {
				serviceAccountEmail: 'publisher@ard-eventhub.iam.gserviceaccount.com',
				audience: '',
			},
		},
		labels: {
			id: subscription.id?.toString() ?? '',
			stage: stage,
			'creator-slug': slug(subscription.creator),
			created: DateTime.now().toFormat('yyyy-LL-dd'),
		},
		ackDeadlineSeconds: 20,
		expirationPolicy: {},
	}
	logger.log({
		level: 'info',
		message: 'built options',
		source,
		data: { subscription, options },
	})

	// submit subscription
	const [createdSubscription] = await pubSubSubscriberClient.createSubscription(options)
	logger.log({
		level: 'info',
		message: 'created subscription',
		source,
		data: { createdSubscription },
	})

	// map and filter values
	const { limited: mappedSubscription } = await mapSubscription(createdSubscription)
	logger.log({
		level: 'info',
		message: 'mapped subscription',
		source,
		data: { mappedSubscription },
	})

	return mappedSubscription
}
