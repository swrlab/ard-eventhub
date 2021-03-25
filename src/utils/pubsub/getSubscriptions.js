/*

	ard-eventhub
	by SWR audio lab

*/

// load other utils
const pubSubClient = require('./_client')
const mapSubscription = require('./mapSubscription')

// load config
const config = require('../../../config')

module.exports = async () => {
	// fetch subscriptions list
	let [subscriptions] = await pubSubClient.getSubscriptions()

	// filter subscriptions by prefix (stage)
	subscriptions = subscriptions.filter((subscription) => subscription.name.indexOf(config.pubSubPrefix) !== -1)

	// map and filter values
	subscriptions = await Promise.all(
		subscriptions.map(async (subscription) => {
			const { limited } = await mapSubscription(subscription)
			return Promise.resolve(limited)
		})
	)

	// return data
	return Promise.resolve(subscriptions)
}
