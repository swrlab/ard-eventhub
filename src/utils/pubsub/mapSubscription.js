/*

	ard-eventhub
	by SWR Audio Lab

*/

// load utils
const convertId = require('./convertId')
const datastore = require('../datastore')

// load config
const config = require('../../../config')

module.exports = async (subscription) => {
	// remap vars to metadata object
	// this is needed since pubsub feedback from new subscriptions is slightly different
	if (!subscription.metadata) {
		subscription.metadata = subscription
	}

	// preset vars
	const lookup = subscription.metadata?.labels?.id
		? await datastore.load('subscriptions', Number.parseInt(subscription.metadata.labels.id))
		: null

	// remap values
	const topicName = subscription.metadata.topic.split('/').pop()
	const limited = {
		type: 'PUBSUB',
		method: subscription.metadata.pushConfig?.pushEndpoint ? 'PUSH' : 'PULL',

		name: subscription.name.split('/').pop(),
		path: subscription.name,

		topic: {
			id: convertId.decode(topicName).replace(config.pubSubPrefix, ''),
			name: topicName,
			path: subscription.metadata.topic,
		},

		ackDeadlineSeconds: subscription.metadata.ackDeadlineSeconds,
		retryPolicy: subscription.metadata.retryPolicy,
		serviceAccount: subscription.metadata.pushConfig?.oidcToken?.serviceAccountEmail ?? null,

		url: subscription.metadata.pushConfig?.pushEndpoint ?? null,
		contact: lookup?.contact ?? null,
		institutionId: lookup?.institutionId ?? null,
	}

	const full = {
		...limited,

		labels: subscription.metadata.labels,
	}

	// return data
	return Promise.resolve({ limited, full })
}
