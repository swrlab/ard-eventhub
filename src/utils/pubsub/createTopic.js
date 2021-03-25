/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const slug = require('slug')
const moment = require('moment')

// load pubsub for internal queues
const publisherClient = require('./_publisherClient')
const config = require('../../../config')

module.exports = async (newTopic) => {
	// create new topic
	const topic = {
		name: `projects/${process.env.GCP_PROJECT_ID}/topics/${newTopic.name}`,
		labels: {
			created: moment().format('YYYY-MM-DD'),
			creator: slug(newTopic.creator),

			id: newTopic.id,

			'institution-title': slug(newTopic.institution.title),
			'publisher-title': slug(newTopic.publisher.title),

			stage: config.stage,
		},
	}

	return publisherClient.createTopic(topic)
}
