/*

	ard-eventhub
	by SWR Audio Lab

*/

// load pubsub for internal queues
const pubSubClient = require('./_client')

module.exports = async (name) => {
	// fetch topic list
	const [subscription] = await pubSubClient.subscription(name).delete()

	// return data
	return Promise.resolve(subscription)
}
