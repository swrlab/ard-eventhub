/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const pubSubClient = require('./_client')

// load config
const config = require('../../../config')

module.exports = async (topicName) => {
	// fetch topic list
	const [topic] = await pubSubClient.topic(topicName).get()

	// filter topics by prefix (stage)
	if (!topic || topic.name.indexOf(config.pubSubPrefix) === -1)
		return Promise.reject(new Error(`topic not found > ${topicName}`))

	// return data
	return Promise.resolve(topic)
}
