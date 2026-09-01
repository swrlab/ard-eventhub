import type { AuthUser } from '#types'
import type { EventhubService } from '../../schemas/events.ts'
import { logger } from '@frytg/logger'
// @ts-expect-error - The package does not yet have types.
import { createHashedId } from '@swrlab/utils/packages/ard/index.js'
import { coreIdPrefixes } from '#config'
import allowedLivestreamsJson from '../../config/allowed-livestreams.json' with { type: 'json' }
import { allowedLivestreamsConfig } from '../../schemas/config.ts'
import { getPublisherById } from '../ard-core.ts'
import { pubsubBuildId } from '../pubsub/build-id.ts'

const source = 'utils.events.processServices'
const URN_PUBLISHER_PREFIX = coreIdPrefixes.Publisher
const URN_PUBLISHER_REGEX = /(?=urn:ard:publisher:[a-z0-9]{16})/g

const parsedAllowedLivestreams = allowedLivestreamsConfig.parse(allowedLivestreamsJson)

/** Topic id → allow-listed COMMON_IDS livestream, built once at module load. */
const allowedLivestreamsById = new Map(
	parsedAllowedLivestreams.livestreams.map((livestream) => [livestream.id, livestream])
)

/**
 * Allow-listed COMMON_IDS livestream lookup. Tests stub `getById` with sinon.
 */
export const allowedLivestreamLookup = {
	/**
	 * Look up an allow-listed COMMON_IDS livestream by topic id.
	 * @param topicId - Computed topic URN (`service.topic.id`)
	 * @returns Allow-list entry when present
	 */
	getById(topicId: string) {
		return allowedLivestreamsById.get(topicId)
	},
}

/**
 * Enrich a service with topic ids and block unauthorized publishers.
 * Allow-listed COMMON_IDS topics (absent from the ARD feed) may only be published
 * under their configured `publisherId`; institution is still checked via the feed.
 * @param service - Service from the event body
 * @param params - Authenticated user
 * @returns Updated service (possibly blocked)
 */
export const processServices = async (
	service: EventhubService,
	params: {
		user: AuthUser
	}
) => {
	const { user } = params

	// fetch prefix from configured list
	const type = service.type as keyof typeof coreIdPrefixes
	const urnPrefix = coreIdPrefixes[type]

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

	const allowedLivestream = allowedLivestreamLookup.getById(topicId)

	// COMMON_IDS topics may only be published under their designated publisher
	if (allowedLivestream && allowedLivestream.publisherId !== service.publisherId) {
		service.blocked = 'User unauthorized for service'

		logger.warning({
			message: `publisher mismatch for allow-listed livestream > ${allowedLivestream.name} > ${service.publisherId}`,
			source,
			data: { service, user, originalPublisherId, allowedLivestream },
		})

		return service
	}

	// fetch publisher (ARD feed); allow-listed topics still resolve institution via publisherId
	const publisher = getPublisherById(service.publisherId)

	// block access if publisher not found
	if (!publisher) {
		// set blocked flag to be filtered out
		service.blocked = `Publisher not found > ${service.publisherId}`

		// log access attempt
		logger.warning({
			message: `publisher not found > ${service.publisherId}`,
			source,
			data: { service, user, originalPublisherId, allowedLivestream },
		})

		// stop processing
		return service
	}

	// check allowed institutions for current user
	if (user.institution.id !== publisher.institution.id) {
		// set blocked flag to be filtered out
		service.blocked = 'User unauthorized for service'

		// log access attempt
		logger.warning({
			message: `user unauthorized for service > ${service.externalId} > ${service.publisherId}`,
			source,
			data: {
				service,
				user,
				institution: publisher.institution,
				originalPublisherId,
				allowedLivestream,
			},
		})

		// stop processing
		return service
	}

	// final data
	return service
}
