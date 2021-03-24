/*

	ard-eventhub
	by SWR audio lab

*/

// load other utils
const pubSubClient = require('./_client')
const mapSubscription = require('./mapSubscription')

module.exports = async () => {
	// fetch subscriptions list
	let [subscriptions] = await pubSubClient.getSubscriptions()

	// DEV filter subscriptions by prefix

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
