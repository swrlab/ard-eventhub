import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { serveTestFeed } from '../feed/test-feed.ts'
import { checkEventOwnership, checkServiceOwnership } from './ownership.ts'

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
	assertEquals(checkServiceOwnership({ subjectInstitutionId: SUBJECT, service, index: 0, owner }), [])
})

test('a payload institution that is not the inbox is an error on institutionId', () => {
	const errors = checkServiceOwnership({
		subjectInstitutionId: SUBJECT,
		service: { ...service, institutionId: OTHER },
		index: 1,
		owner,
	})
	assertEquals(errors, [
		{
			path: '.body.services.1.institutionId',
			message: 'should match the inbox institution',
			errorCode: 'unauthorized.eventhub.validation',
		},
	])
})

test('an inbox that does not own the livestream is unauthorized for the service', () => {
	const errors = checkServiceOwnership({
		subjectInstitutionId: SUBJECT,
		service,
		index: 0,
		owner: { publisherId: PUBLISHER, institutionId: OTHER },
	})
	assertEquals(
		errors.map((error) => [error.path, error.message]),
		[['.body.services.0.id', 'User unauthorized for service']]
	)
})

test('a publisher the feed does not list for the livestream is an error on publisherId', () => {
	const errors = checkServiceOwnership({
		subjectInstitutionId: SUBJECT,
		service: { ...service, publisherId: 'urn:ard:publisher:0000000000000000' },
		index: 0,
		owner,
	})
	assertEquals(
		errors.map((error) => error.path),
		['.body.services.0.publisherId']
	)
})

test('a livestream the feed does not know is not found', () => {
	assertEquals(checkServiceOwnership({ subjectInstitutionId: SUBJECT, service, index: 0, owner: null }), [
		{
			path: '.body.services.0.id',
			message: `Livestream not found > ${LIVESTREAM}`,
			errorCode: 'notFound.eventhub.validation',
		},
	])
})

test('event ownership checks every service against the served feed in services order', () => {
	const unknown = 'urn:ard:permanent-livestream:0000000000000000'
	const restore = serveTestFeed({ [LIVESTREAM]: owner })
	try {
		assertEquals(checkEventOwnership({ subjectInstitutionId: SUBJECT, services: [service] }), [])
		const errors = checkEventOwnership({
			subjectInstitutionId: SUBJECT,
			services: [
				{ ...service, publisherId: 'urn:ard:publisher:0000000000000000' },
				{ ...service, id: unknown },
			],
		})
		assertEquals(
			errors.map((error) => error.path),
			['.body.services.0.publisherId', '.body.services.1.id']
		)
	} finally {
		restore()
	}
})
