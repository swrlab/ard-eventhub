/*

	ard-eventhub
	by SWR Audio Lab

*/

// load utils
import convertId from './convertId'
import datastore from '../datastore'

// load config
import config from '../../../config'
import { Subscription } from '@google-cloud/pubsub'
import { google } from '@google-cloud/pubsub/build/protos/protos'
import ISubscription = google.pubsub.v1.ISubscription

export default async (subscription: Subscription | ISubscription & {metadata:any}) => {
	// remap vars to metadata object
	// this is needed since pubsub feedback from new subscriptions is slightly different
	if (!subscription.metadata) {
		subscription.metadata = {...subscription} as ISubscription
	}

	// preset vars
	const lookup = subscription.metadata?.labels?.id
		? await datastore.load('subscriptions', Number.parseInt(subscription.metadata.labels.id))
		: null

	// remap values
	const topicName = subscription.metadata?.topic?.split('/').pop()
	const limited = {
		type: 'PUBSUB',
		method: subscription.metadata?.pushConfig?.pushEndpoint ? 'PUSH' : 'PULL',

		name: subscription.name?.split('/').pop(),
		path: subscription.name,

		topic: {
			id: convertId.decode(topicName!!).replace(config.pubSubPrefix, ''),
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

	const full = {
		...limited,

		labels: subscription.metadata?.labels,
	}

	// return data
	return Promise.resolve({ limited, full })
}
