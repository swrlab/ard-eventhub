import { pubSubPrefix } from '#config'
import type {
	EventhubSubscriptionDatastore,
	EventhubSubscriptionLimited,
	EventhubSubscriptionWithLabels,
	ISubscription,
	Subscription,
} from '#types'
import datastore from '../datastore/index.ts'

export default async (
	subscription: Subscription | ISubscription
): Promise<{
	limited: EventhubSubscriptionLimited
	full: EventhubSubscriptionWithLabels
}> => {
	const metadata = isSubscription(subscription)
		? (subscription.metadata as ISubscription)
		: (subscription as ISubscription)

	const labels = metadata.labels as EventhubSubscriptionWithLabels['labels']
	const lookup: EventhubSubscriptionDatastore | undefined = labels?.id
		? await datastore.load('subscriptions', Number.parseInt(labels.id, 10))
		: undefined

	// remap values
	const topic = metadata.topic as string
	const topicName = topic.split('/').pop() as string
	const limited: EventhubSubscriptionLimited = {
		type: 'PUBSUB',
		method: metadata.pushConfig?.pushEndpoint ? 'PUSH' : 'PULL',

		name: subscription.name?.split('/').pop(),
		path: subscription.name,

		topic: {
			id: decodeURIComponent(topicName).replace(pubSubPrefix, ''),
			name: topicName,
			path: topic,
		},

		ackDeadlineSeconds: metadata.ackDeadlineSeconds,
		retryPolicy: metadata.retryPolicy,
		serviceAccount: metadata.pushConfig?.oidcToken?.serviceAccountEmail,

		url: metadata.pushConfig?.pushEndpoint,
		contact: lookup?.contact,
		institutionId: lookup?.institutionId,
	}

	const full: EventhubSubscriptionWithLabels = {
		...limited,
		labels,
	}

	return { limited, full }
}

function isSubscription(s: Subscription | ISubscription): s is Subscription {
	return 'metadata' in s && Boolean(s.metadata)
}
