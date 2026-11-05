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

test('event ownership accepts an overlay topic from any of its allowed publishers', () => {
	const musikclub = 'urn:ard:permanent-livestream:7c0dd5c9f90b67ab'
	const swr1Bw = 'urn:ard:publisher:ea659609f53316e6'
	const swr1Rp = 'urn:ard:publisher:2d74b4350f0d4d53'
	const restore = serveTestFeed({
		'urn:ard:permanent-livestream:c2656164ae0f6745': { publisherId: swr1Bw, institutionId: SUBJECT },
		'urn:ard:permanent-livestream:e55592f337f172a5': { publisherId: swr1Rp, institutionId: SUBJECT },
	})
	try {
		const services = [swr1Bw, swr1Rp].map((publisherId) => ({ id: musikclub, publisherId, institutionId: SUBJECT }))
		assertEquals(checkEventOwnership({ subjectInstitutionId: SUBJECT, services }), [])
		const errors = checkEventOwnership({
			subjectInstitutionId: SUBJECT,
			services: [{ id: musikclub, publisherId: PUBLISHER, institutionId: SUBJECT }],
		})
		assertEquals(
			errors.map((error) => error.path),
			['.body.services.0.publisherId']
		)
	} finally {
		restore()
	}
})
