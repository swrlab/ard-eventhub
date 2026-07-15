/*

	ard-eventhub
	by SWR Audio Lab

*/

import { pubSubPrefix } from '#config'
import type {
	EventhubSubscriptionDatastore,
	EventhubSubscriptionLimited,
	EventhubSubscriptionWithLabels,
	ISubscription,
	Subscription,
} from '#types'
import datastoreLoad from '../datastore/load.ts'
import convertId from './convertId.ts'

type MappableSubscription = Subscription | (ISubscription & { metadata?: ISubscription })

export default async (
	subscription: MappableSubscription
): Promise<{ limited: EventhubSubscriptionLimited; full: EventhubSubscriptionWithLabels }> => {
	// remap vars to metadata object
	// this is needed since pubsub feedback from new subscriptions is slightly different
	if (!subscription.metadata) {
		subscription.metadata = { ...subscription } as ISubscription
	}

	const metadata = subscription.metadata as ISubscription
	const subscriptionName = subscription.name ?? metadata.name

	// preset vars
	const lookup: EventhubSubscriptionDatastore | undefined = metadata.labels?.id
		? await datastoreLoad('subscriptions', Number.parseInt(metadata.labels.id, 10))
		: undefined

	const topic = metadata.topic
	if (!topic) {
		throw new Error('The topic is missing from the subscription metadata.')
	}
	const topicName = topic.split('/').pop()
	if (!topicName) {
		throw new Error(`The topicName is missing from the topic '${topic}'.`)
	}

	// remap values
	const limited: EventhubSubscriptionLimited = {
		type: 'PUBSUB',
		method: metadata.pushConfig?.pushEndpoint ? 'PUSH' : 'PULL',

		name: subscriptionName?.split('/').pop(),
		path: subscriptionName,

		topic: {
			id: convertId.decode(topicName).replace(pubSubPrefix, ''),
			name: topicName,
			path: topic,
		},

		ackDeadlineSeconds: metadata.ackDeadlineSeconds,
		retryPolicy: metadata.retryPolicy,
		serviceAccount: metadata.pushConfig?.oidcToken?.serviceAccountEmail ?? null,

		url: metadata.pushConfig?.pushEndpoint ?? null,
		contact: lookup?.contact,
		institutionId: lookup?.institutionId,
	}

	const full: EventhubSubscriptionWithLabels = {
		...limited,
		labels: metadata.labels as EventhubSubscriptionWithLabels['labels'],
	}

	return { limited, full }
}
