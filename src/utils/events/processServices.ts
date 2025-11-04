/*

	ard-eventhub
	by SWR Audio Lab

*/

import { createHashedId } from '@swrlab/utils/packages/ard'

import type UserTokenRequest from '@/src/ingest/auth/middleware/userTokenRequest.ts'
import config from '../../../config'
import core from '../core'
import logger from '../logger'
import pubsub from '../pubsub'

const source = 'utils.events.processServices'
const URN_PUBLISHER_PREFIX = config.coreIdPrefixes.Publisher
const URN_PUBLISHER_REGEX = /(?=urn:ard:publisher:[a-z0-9]{16})/g

export default async (service: any, req: UserTokenRequest) => {
	// fetch prefix from configured list
	const type = service.type as keyof typeof config.coreIdPrefixes
	let urnPrefix = config.coreIdPrefixes[type]

	// add a different suffix for radio text topics to not confuse subscribers with new event
	if (req.body.event === 'de.ard.eventhub.v1.radio.text') {
		urnPrefix = `radio-text:${urnPrefix}`
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
		// DEV TEMP debug log
		service.publisherIdOrig = service.publisherId

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
	if (!req.user || req.user.institutionId !== publisher?.publisher.institution.id) {
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
				publisher: publisher?.publisher.institution,
			},
		})

		// stop processing
		return service
	}

	// final data
	return service
}
