/*

	ard-eventhub
	by SWR Audio Lab

*/

// load node utils
const { createHashedId } = require('@swrlab/utils/packages/ard')

// load eventhub utils
const core = require('../core')
const logger = require('../logger')
const pubsub = require('../pubsub')

// load config
const { coreIdPrefixes } = require('../../../config')

const source = 'utils.events.processServices'
const URN_PUBLISHER_PREFIX = coreIdPrefixes.Publisher
const URN_PUBLISHER_REGEX = /(?=urn:ard:publisher:[a-z0-9]{16})/g

module.exports = async (service, req) => {
	// fetch prefix from configured list
	let urnPrefix = coreIdPrefixes[service.type]

	// add a different suffix for radio text topics to not confuse subscribers with new event
	if (req.body.event === 'de.ard.eventhub.v1.radio.text') {
		urnPrefix = `RadioText:${urnPrefix}`
	}

	const topicId = `${urnPrefix}${createHashedId(service.externalId)}`

	// create hash based on prefix and id
	service.topic = {
		// add basic name
		id: topicId,

		// add pub/sub-compliant name
		name: pubsub.buildId(topicId),
	}

	// convert publisher if not in new ARD urn format
	if (!service.publisherId.match(URN_PUBLISHER_REGEX)) {
		// add trailing 0 if number is only 5 digits
		if (service.publisherId.length === 5) {
			service.publisherId = `${service.publisherId}0`
		}

		// create hash using given publisherId
		service.publisherId = `${URN_PUBLISHER_PREFIX}${createHashedId(service.publisherId)}`
	}

	// fetch publisher
	const publisher = await core.getPublisher(service.publisherId)

	// block access if publisher not found
	if (!publisher) {
		// set blocked flag to be filtered out
		service.blocked = `Publisher not found > ${service.publisherId}`

		// log access attempt
		logger.log({
			level: 'warning',
			message: `Publisher not found (${service.publisherId})`,
			source,
			data: { service, user: req.user },
		})

		// stop processing
		return service
	}

	// check allowed institutions for current user
	if (req.user.institutionId !== publisher?.institution?.id) {
		// set blocked flag to be filtered out
		service.blocked = 'User unauthorized for service'

		// log access attempt
		logger.log({
			level: 'warning',
			message: `User unauthorized for service > ${service.externalId} (${service.publisherId})`,
			source,
			data: {
				service,
				user: req.user,
				publisher: publisher?.institution,
			},
		})

		// stop processing
		return service
	}

	// final data
	return service
}
