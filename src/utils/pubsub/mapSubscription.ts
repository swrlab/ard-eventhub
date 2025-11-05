/*

	ard-eventhub
	by SWR Audio Lab

*/

import type { Subscription } from '@google-cloud/pubsub'
import type { google } from '@google-cloud/pubsub/build/protos/protos'

import type {
	EventhubSubscriptionDatastore,
	EventhubSubscriptionLimited,
	EventhubSubscriptionWithLabels,
} from '@/types.eventhub'
import config from '../../../config'
import datastore from '../datastore'
import convertId from './convertId'

export default async (
	subscription: Subscription | (google.pubsub.v1.ISubscription & { metadata: any })
): Promise<{ limited: EventhubSubscriptionLimited; full: EventhubSubscriptionWithLabels }> => {
	// remap vars to metadata object
	// this is needed since pubsub feedback from new subscriptions is slightly different
	if (!subscription.metadata) {
		subscription.metadata = { ...subscription } as google.pubsub.v1.ISubscription
	}

	// preset vars
	const lookup: EventhubSubscriptionDatastore | null = subscription.metadata?.labels?.id
		? await datastore.load('subscriptions', Number.parseInt(subscription.metadata.labels.id, 10))
		: null

	// remap values
	const topicName = subscription.metadata?.topic?.split('/').pop()
	const limited: EventhubSubscriptionLimited = {
		type: 'PUBSUB',
		method: subscription.metadata?.pushConfig?.pushEndpoint ? 'PUSH' : 'PULL',

		name: subscription.name?.split('/').pop(),
		path: subscription.name,

		topic: {
			id: convertId.decode(topicName).replace(config.pubSubPrefix, ''),
			name: topicName,
			path: subscription.metadata?.topic,
		},

		ackDeadlineSeconds: subscription.metadata?.ackDeadlineSeconds,
		retryPolicy: subscription.metadata?.retryPolicy,
		serviceAccount: subscription.metadata?.pushConfig?.oidcToken?.serviceAccountEmail ?? null,

		url: subscription.metadata?.pushConfig?.pushEndpoint ?? null,
		contact: lookup?.contact ?? null,
		institutionId: lookup?.institutionId ?? null,
	}

	const full: EventhubSubscriptionWithLabels = {
		...limited,

		labels: subscription.metadata?.labels,
	}

	// return data
	return Promise.resolve({ limited, full })
}
