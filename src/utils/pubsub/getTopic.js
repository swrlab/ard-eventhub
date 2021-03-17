/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const pubSubClient = require('./_client')

module.exports = async (topicName) => {
	// fetch topic list
	let [topic] = await pubSubClient.topic(topicName).get()

	// DEV filter topics by prefix

	// map values
	topic = {
		type: 'PUBSUB',
		name: topic.name.split('/').pop(),
		path: topic.name,
		labels: topic.metadata.labels,
	}

	// return data
	return Promise.resolve(topic)
}
