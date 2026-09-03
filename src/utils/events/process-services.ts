import type { ArdPublisher, AuthUser } from '#types'
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
const LIVESTREAM_URN_REGEX = /^urn:ard:(permanent-livestream|event-livestream):[a-z0-9]+$/

/**
 * Whether a service id is already a livestream URN.
 * @param id - Candidate id
 * @returns True when the id is `urn:ard:{permanent|event}-livestream:{hash}`
 */
const isLivestreamUrn = (id: string | undefined): id is string => Boolean(id && LIVESTREAM_URN_REGEX.test(id))

/**
 * Livestream URN for an outgoing service.
 * Uses a supplied `id` when it is already a URN; otherwise hashes `type` + `externalId`.
 * @param service - Service from the event body
 * @returns Livestream URN
 */
const resolveLivestreamId = (service: EventhubService): string => {
	if (isLivestreamUrn(service.id)) {
		return service.id
	}
	const type = service.type as keyof typeof coreIdPrefixes
	return `${coreIdPrefixes[type]}${createHashedId(service.externalId)}`
}

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
 * Institution URN for an outgoing service.
 * Uses the publisher's house when the feed resolved one; otherwise the authenticated user's.
 * @param publisher - Feed publisher, if resolved
 * @param user - Authenticated ingest user
 * @returns Institution URN
 */
const resolveInstitutionId = (publisher: ArdPublisher | undefined, user: AuthUser): string =>
	publisher?.institution.id ?? user.institution.id

/**
 * Enrich a service with topic ids, normalized identifier URNs, and block unauthorized publishers.
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

	const topicId = resolveLivestreamId(service)

	// save original publisher id for logging
	const originalPublisherId = service.publisherId

	// livestream URN on the service itself (same value as topic.id)
	service.id = topicId

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

	const publisher = getPublisherById(service.publisherId)
	service.institutionId = resolveInstitutionId(publisher, user)

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
