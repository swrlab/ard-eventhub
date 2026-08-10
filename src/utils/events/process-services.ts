import type { EventRequestContext } from '#types'
import type { EventhubService } from '../../schemas/events.ts'
import logger from '@frytg/logger'
// @ts-expect-error - The package does not yet have types.
import { createHashedId } from '@swrlab/utils/packages/ard/index.js'
import { coreIdPrefixes } from '#config'
import { getPublisherById } from '../ard-core.ts'
import { pubsubBuildId } from '../pubsub/build-id.ts'

const source = 'utils.events.processServices'
const URN_PUBLISHER_PREFIX = coreIdPrefixes.Publisher
const URN_PUBLISHER_REGEX = /(?=urn:ard:publisher:[a-z0-9]{16})/g

/**
 * Enrich a service with topic ids and block unauthorized publishers.
 * @param service - Service from the event body
 * @param req - Event request context (user + body)
 * @returns Updated service (possibly blocked)
 */
export const processServices = async (service: EventhubService, req: EventRequestContext) => {
	// fetch prefix from configured list
	const type = service.type as keyof typeof coreIdPrefixes
	let urnPrefix = coreIdPrefixes[type]

	// add a different suffix for radio text topics to not confuse subscribers with new event
	if (req.body.event === 'de.ard.eventhub.v1.radio.text') {
		urnPrefix = `radio-text:${urnPrefix}`
	}

	const topicId = `${urnPrefix}${createHashedId(service.externalId)}`

	// save original publisher id for logging
	const originalPublisherId = service.publisherId

	// create hash based on prefix and id
	service.topic = {
		// add basic name
		id: topicId,

		// add pub/sub-compliant name
		name: pubsubBuildId(topicId),
	}

	// convert publisher if not in new ARD urn format
	if (!service.publisherId.match(URN_PUBLISHER_REGEX)) {
		// create hash using given publisherId
		service.publisherId = `${URN_PUBLISHER_PREFIX}${createHashedId(service.publisherId)}`
	}

	// fetch publisher
	const publisher = getPublisherById(service.publisherId)

	// block access if publisher not found
	if (!publisher) {
		// set blocked flag to be filtered out
		service.blocked = `Publisher not found > ${service.publisherId}`

		// log access attempt
		logger.warning({
			message: `publisher not found > ${service.publisherId}`,
			source,
			data: { service, user: req.user, originalPublisherId },
		})

		// stop processing
		return service
	}

	// check allowed institutions for current user
	if (!req.user || req.user.institution.id !== publisher?.institution.id) {
		// set blocked flag to be filtered out
		service.blocked = 'User unauthorized for service'

		// log access attempt
		logger.warning({
			message: `user unauthorized for service > ${service.externalId} > ${service.publisherId}`,
			source,
			data: {
				service,
				user: req.user,
				institution: publisher?.institution,
				originalPublisherId,
			},
		})

		// stop processing
		return service
	}

	// final data
	return service
}
