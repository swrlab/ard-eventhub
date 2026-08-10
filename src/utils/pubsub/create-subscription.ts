import type { ISubscription } from '#types'
import type { EventhubSubscriptionDatastore } from '../../schemas/subscriptions.ts'
import { DateTime } from '@frytg/dates'
import logger from '@frytg/logger'
import slug from 'slug'
import { projectId, stage } from '#env'
import { pubSubSubscriberClient } from './_subscriber-client.ts'
import { mapSubscription } from './map-subscription.ts'

const source = 'utils/pubsub/createSubscription'

export const pubsubCreateSubscription = async (subscription: EventhubSubscriptionDatastore) => {
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
	logger.info({
		message: 'built options',
		source,
		data: { subscription, options },
	})

	// submit subscription
	const [createdSubscription] = await pubSubSubscriberClient.createSubscription(options)
	logger.info({
		message: 'created subscription',
		source,
		data: { createdSubscription },
	})

	// map and filter values
	const { limited: mappedSubscription } = await mapSubscription(createdSubscription)
	logger.info({
		message: 'mapped subscription',
		source,
		data: { mappedSubscription },
	})

	return mappedSubscription
}
