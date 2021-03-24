/*

	ard-eventhub
	by SWR audio lab

*/

// load pubsub for internal queues
const pubSubClient = require('./_client')
const convertId = require('./convertId')

// load config
const config = require('../../../config')

module.exports = async () => {
	// fetch topic list
	let [topics] = await pubSubClient.getTopics()

	// filter topics by prefix (stage)
	topics = topics.filter((topic) => topic.name.indexOf(config.pubSubPrefix) !== -1)

	// map values
	topics = topics.map((topic) => {
		const name = topic.name.split('/').pop()

		return {
			type: 'PUBSUB',
			id: convertId.decode(name).replace(config.pubSubPrefix, ''),
			labels: topic.metadata.labels,
			pubSub: {
				name,
				path: topic.name,
			},
		}
	})

	// return data
	return Promise.resolve(topics)
}
