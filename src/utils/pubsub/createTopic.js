/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const publisherClient = require('./_publisherClient')
const config = require('../../../config')

module.exports = async (newTopic) => {
	// create new topic
	const prefix = 'projects/ard-eventhub/topics/'
	const topic = {
		name: prefix + newTopic.pubsub,
		labels: {
			name: newTopic.label,
			stage: config.stage,
		},
	}

	return publisherClient.createTopic(topic)
}
