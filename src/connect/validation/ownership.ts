import type { LivestreamOwner, ValidationErrorItem } from '#types'
import { currentOwners } from '../feed/current-feed.ts'

const UNAUTHORIZED = 'unauthorized.eventhub.validation'
const NOT_FOUND = 'notFound.eventhub.validation'

/**
 * Compare one service with the inbox subject and the feed row for its livestream.
 * The inbox institution must own the livestream, `institutionId` must name the inbox, and `publisherId` must be the
 * feed's publisher. Comparing the inbox with both sides covers a payload institution that only matches the feed.
 * @param params - Subject institution, the service claim, its index in `services`, and the feed row (null when unknown)
 * @returns Errors in the HTTPS API shape, empty when the service is allowed
 */
export const checkServiceOwnership = (params: {
	subjectInstitutionId: string
	service: { id: string; publisherId: string; institutionId: string }
	index: number
	owner: LivestreamOwner | null
}): ValidationErrorItem[] => {
	const { subjectInstitutionId, service, index, owner } = params
	const path = `.body.services.${index}`
	if (!owner) return [{ path: `${path}.id`, message: `Livestream not found > ${service.id}`, errorCode: NOT_FOUND }]

	const errors: ValidationErrorItem[] = []
	if (subjectInstitutionId !== owner.institutionId) {
		errors.push({ path: `${path}.id`, message: 'User unauthorized for service', errorCode: UNAUTHORIZED })
	}
	if (service.institutionId !== subjectInstitutionId) {
		errors.push({
			path: `${path}.institutionId`,
			message: 'should match the inbox institution',
			errorCode: UNAUTHORIZED,
		})
	}
	if (service.publisherId !== owner.publisherId) {
		errors.push({
			path: `${path}.publisherId`,
			message: 'should match the publisher of the livestream',
			errorCode: UNAUTHORIZED,
		})
	}
	return errors
}

/**
 * Check every service of one event against the serving feed.
 * Throws when no feed is loaded, so the loop naks instead of rejecting a valid event.
 * @param params - Subject institution and the event's services
 * @returns Errors for every failing service in `services` order, empty when all are allowed
 */
export const checkEventOwnership = (params: {
	subjectInstitutionId: string
	services: readonly { id: string; publisherId: string; institutionId: string }[]
}): ValidationErrorItem[] => {
	const { subjectInstitutionId, services } = params
	const owners = currentOwners()
	if (!owners) throw new Error('ard feed is not loaded')
	return services.flatMap((service, index) =>
		checkServiceOwnership({ subjectInstitutionId, service, index, owner: owners.get(service.id) ?? null })
	)
}
