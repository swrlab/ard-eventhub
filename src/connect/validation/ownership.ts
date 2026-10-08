import type { LivestreamOwner, OwnershipParty, OwnershipProblem } from '#types'

const PARTY_ORDER: readonly OwnershipParty[] = ['subject', 'payload', 'feed']

/**
 * Stable party list: subject, then payload, then feed.
 * @param parties - Parties that disagreed
 * @returns Parties in display order
 */
const orderedParties = (parties: ReadonlySet<OwnershipParty>): OwnershipParty[] =>
	PARTY_ORDER.filter((party) => parties.has(party))

/**
 * Compare one service with the inbox subject and the feed row for its livestream.
 * All three institution ids must match, and `publisherId` must be the feed's publisher.
 * @param params - Subject institution, the service claim, and the feed row (null when unknown)
 * @returns A problem, or null when the three sides agree
 */
export const checkServiceOwnership = (params: {
	subjectInstitutionId: string
	service: { id: string; publisherId: string; institutionId: string }
	owner: LivestreamOwner | null
}): OwnershipProblem | null => {
	const { subjectInstitutionId, service, owner } = params
	if (!owner) {
		return {
			livestreamId: service.id,
			disagreed: ['feed'],
			message: `livestream ${service.id} is not in the feed`,
		}
	}

	const disagreed = new Set<OwnershipParty>()
	const notes: string[] = []
	if (service.institutionId !== subjectInstitutionId) {
		disagreed.add('subject')
		disagreed.add('payload')
		notes.push('payload institutionId does not match the inbox subject')
	}
	if (service.institutionId !== owner.institutionId) {
		disagreed.add('payload')
		disagreed.add('feed')
		notes.push('payload institutionId does not match the feed')
	}
	if (subjectInstitutionId !== owner.institutionId) {
		disagreed.add('subject')
		disagreed.add('feed')
		notes.push('inbox subject does not match the feed institution')
	}
	if (service.publisherId !== owner.publisherId) {
		disagreed.add('payload')
		disagreed.add('feed')
		notes.push('payload publisherId does not match the feed')
	}
	if (disagreed.size === 0) return null
	return {
		livestreamId: service.id,
		disagreed: orderedParties(disagreed),
		message: `${service.id}: ${notes.join('; ')}`,
	}
}

/**
 * Check every service of one event and merge the failures into one problem for feedback.
 * @param params - Subject institution, the event's services, and the feed owner index
 * @returns The merged problem (first failing livestream, union of parties, joined messages), or null when all agree
 */
export const checkEventOwnership = (params: {
	subjectInstitutionId: string
	services: readonly { id: string; publisherId: string; institutionId: string }[]
	owners: ReadonlyMap<string, LivestreamOwner>
}): OwnershipProblem | null => {
	const { subjectInstitutionId, services, owners } = params
	const problems = services.flatMap((service) => {
		const problem = checkServiceOwnership({ subjectInstitutionId, service, owner: owners.get(service.id) ?? null })
		return problem ? [problem] : []
	})
	const first = problems[0]
	if (!first) return null
	return {
		livestreamId: first.livestreamId,
		disagreed: orderedParties(new Set(problems.flatMap((problem) => problem.disagreed))),
		message: problems.map((problem) => problem.message).join('; '),
	}
}
