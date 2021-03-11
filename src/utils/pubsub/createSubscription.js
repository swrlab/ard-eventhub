/*

	ard-eventhub
	by SWR audio lab

*/

// load other utils
const loggerDev = require('../loggerDev');
const pubSubSubscriberClient = require('./_subscriberClient');
const mapSubscription = require('./mapSubscription');

module.exports = async (subscription) => {
	// map inputs for pubsub
	let options = {
		name: `projects/${process.env.GCP_PROJECT_ID}/subscriptions/${subscription.name}`,
		topic: `projects/${process.env.GCP_PROJECT_ID}/topics/${subscription.topic}`,
		pushConfig: {
			pushEndpoint: subscription.url,
			oidcToken: {
				serviceAccountEmail: 'publisher@ard-eventhub.iam.gserviceaccount.com',
				audience: '',
			},
			authenticationMethod: 'oidcToken',
		},
		labels: {
			id: subscription.id,
			institution: subscription.institution.name,
		},
		ackDeadlineSeconds: 20,
	};
	loggerDev('log', [
		'utils/pubsub/createSubscription',
		'built options',
		JSON.stringify({ subscription, options }),
	]);

	// submit subscription
	let [createdSubscription] = await pubSubSubscriberClient.createSubscription(options);
	loggerDev('log', [
		'utils/pubsub/createSubscription',
		'created subscription',
		JSON.stringify({ createdSubscription }),
	]);

	// map and filter values
	createdSubscription = await mapSubscription(createdSubscription);
	loggerDev('log', [
		'utils/pubsub/createSubscription',
		'mapped subscription',
		JSON.stringify({ createdSubscription }),
	]);

	// return data
	return Promise.resolve(createdSubscription);
};
