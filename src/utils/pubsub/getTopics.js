/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const pubSubClient = require('./_client')
const config = require('../../../config')

module.exports = async () => {
	// fetch topic list
	let [topics] = await pubSubClient.getTopics()

	// filter topics by stage
	topics = topics.filter((topic) => topic.name.split('/').pop().indexOf(`.${config.stage}.`) !== -1)

	// map values
	topics = topics.map((topic) => {
		return {
			type: 'PUBSUB',
			name: topic.name.split('/').pop(),
			path: topic.name,
			labels: topic.metadata.labels,
		}
	})

	// return data
	return Promise.resolve(topics)
}
