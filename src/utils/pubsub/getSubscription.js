/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const pubSubClient = require('./_client')
const mapSubscription = require('./mapSubscription')

// load config
const config = require('../../../config')

module.exports = async (name) => {
	// fetch subscription list
	const [subscription] = await pubSubClient.subscription(name).getMetadata()

	// filter subscriptions by prefix
	if (!subscription || subscription.name.indexOf(config.pubSubPrefix) === -1)
		return Promise.reject(new Error(`subscription not found > ${name}`))

	// map and filter values
	const mappedSubscription = await mapSubscription(subscription)

	// return data
	return Promise.resolve(mappedSubscription)
}
