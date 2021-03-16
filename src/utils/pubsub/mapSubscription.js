/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const datastore = require('../datastore');

module.exports = async (subscription) => {
	// remap vars to metadata object
	// this is needed since pubsub feedback from new subscriptions is slightly different
	if (!subscription.metadata) {
		subscription.metadata = subscription;
	}

	// preset vars
	const lookup = subscription.metadata?.labels?.id
		? await datastore.load('subscriptions', parseInt(subscription.metadata.labels.id))
		: null;

	// remap values
	subscription = {
		type: 'PUBSUB',
		method: subscription.metadata.pushConfig?.pushEndpoint ? 'PUSH' : 'PULL',

		name: subscription.name.split('/').pop(),
		path: subscription.name,

		url: subscription.metadata.pushConfig?.pushEndpoint ?? null,

		topic: {
			name: subscription.metadata.topic.split('/').pop(),
			path: subscription.metadata.topic,
		},

		ackDeadlineSeconds: subscription.metadata.ackDeadlineSeconds,
		retainAckedMessages: subscription.metadata.retainAckedMessages,
		retryPolicy: subscription.metadata.retryPolicy,
		serviceAccount: subscription.metadata.pushConfig?.oidcToken?.serviceAccountEmail ?? null,

		labels: subscription.metadata.labels,

		created: lookup?.created ?? null,
		contact: lookup?.contact ?? null,
		owner: lookup?.owner ?? null,
		institution: lookup?.institution ?? null,
	};

	// return data
	return Promise.resolve(subscription);
};
