/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const slug = require('slug')
const { DateTime } = require('luxon')

// load pubsub for internal queues
const publisherClient = require('./_publisherClient')
const config = require('../../../config')

module.exports = async (newTopic) => {
	// create new topic
	const topic = {
		name: `projects/${process.env.GCP_PROJECT_ID}/topics/${newTopic.name}`,
		labels: {
			created: DateTime.now().toFormat('yyyy-LL-dd'),
			'creator-slug': slug(newTopic.creator),

			id: newTopic.id,

			'institution-slug': slug(newTopic.institution.title),
			'publisher-slug': slug(newTopic.publisher.title),

			stage: config.stage,
		},
	}

	return publisherClient.createTopic(topic)
}
