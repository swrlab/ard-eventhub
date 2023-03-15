/*

	ard-eventhub
	by SWR Audio Lab

*/

// load node utils
const { DateTime } = require('luxon')

// load eventhub utils
const core = require('../core')
const datastore = require('../datastore')
const logger = require('../logger')
const pubsub = require('../pubsub')

const source = 'utils.events.createNewTopic'

module.exports = async (service, req) => {
	// fetch publisher
	const publisher = await core.getPublisher(service.publisherId)

	// try creating new topic
	const newTopic = {
		created: DateTime.now().toUTC().toISO(),
		creator: req.user.email,

		coreId: service.topic.id,
		externalId: service.externalId,
		name: service.topic.name,

		institution: {
			id: req.user.institutionId,
			title: publisher.institution.title,
		},

		publisher: {
			id: service.publisherId,
			title: publisher.title,
		},
	}

	// save topic to datastore
	await datastore.save(newTopic, 'topics')
	newTopic.id = newTopic.id.toString()

	// create topic
	const [result] = await pubsub.createTopic(newTopic)

	// handle feedback
	if (result?.name?.indexOf(service.topic.name) !== -1) {
		// update api result that topic was created
		service.topic.status = 'TOPIC_CREATED'

		logger.log({
			level: 'notice',
			message: `topic created > ${service.topic.name}`,
			source,
			data: { service, result },
		})
	} else {
		// update api result that topic was not created
		service.topic.status = 'TOPIC_NOT_CREATED'

		logger.log({
			level: 'error',
			message: `failed creating topic > ${service.topic.name}`,
			source,
			data: { service, result },
		})
	}

	// insert empty id
	service.topic.messageId = null

	return Promise.resolve(service.topic)
}
