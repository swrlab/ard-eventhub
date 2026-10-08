import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { checkServiceOwnership } from './ownership.ts'

const SUBJECT = 'urn:ard:institution:a3004ff924ece1a2'
const OTHER = 'urn:ard:institution:b71c0e4d9a25f338'
const LIVESTREAM = 'urn:ard:permanent-livestream:49267f7d67be180d'
const PUBLISHER = 'urn:ard:publisher:75dbb3dace15f610'

const owner = { publisherId: PUBLISHER, institutionId: SUBJECT }

const service = {
	id: LIVESTREAM,
	publisherId: PUBLISHER,
	institutionId: SUBJECT,
}

test('ownership accepts the subject, the payload, and the feed when they match', () => {
	assertEquals(checkServiceOwnership({ subjectInstitutionId: SUBJECT, service, owner }), null)
})

test('ownership names a subject/payload mismatch from an authorized inbox', () => {
	const problem = checkServiceOwnership({
		subjectInstitutionId: SUBJECT,
		service: { ...service, institutionId: OTHER },
		owner,
	})
	assertEquals(problem?.disagreed, ['subject', 'payload', 'feed'])
	assertEquals(problem?.message.includes('inbox subject'), true)
})

test('ownership names a publisher that the feed does not list for the livestream', () => {
	const problem = checkServiceOwnership({
		subjectInstitutionId: SUBJECT,
		service: { ...service, publisherId: 'urn:ard:publisher:0000000000000000' },
		owner,
	})
	assertEquals(problem?.disagreed, ['payload', 'feed'])
	assertEquals(problem?.message.includes('publisherId'), true)
})

test('ownership rejects a livestream the feed does not know', () => {
	const problem = checkServiceOwnership({ subjectInstitutionId: SUBJECT, service, owner: null })
	assertEquals(problem?.disagreed, ['feed'])
	assertEquals(problem?.livestreamId, LIVESTREAM)
})
