/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const pubSubClient = require('./_client')
const mapSubscription = require('./mapSubscription')

module.exports = async (name) => {
	// fetch subscription list
	const [subscription] = await pubSubClient.subscription(name).getMetadata()

	// DEV filter subscriptions by prefix

	// map and filter values
	const mappedSubscription = await mapSubscription(subscription)

	// return data
	return Promise.resolve(mappedSubscription)
}
