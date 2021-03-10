/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const pubSubClient = require('./_client');
const mapSubscription = require('./mapSubscription');

module.exports = async (name) => {
	// fetch subscription list
	let [subscription] = await pubSubClient.subscription(name).getMetadata();

	// DEV filter subscriptions by prefix

	// map and filter values
	subscription = await mapSubscription(subscription);

	// return data
	return Promise.resolve(subscription);
};
