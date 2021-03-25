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
			id: newTopic.id,
			creator: slug(newTopic.creator),
			created: moment().format('YYYY-MM-DD'),
			'publisher-title': slug(newTopic.publisherTitle),
			'institution-title': slug(newTopic.institutionTitle),
			stage: config.stage,
		},
	}

	return publisherClient.createTopic(topic)
}
