import type { ArdPublisher, AuthUser } from '#types'
import type { EventhubService } from '../../schemas/events.ts'
import { test } from '@cross/test'
import { assertEquals, assertExists } from '@std/assert'
// @ts-expect-error - The package does not yet have types.
import { createHashedId } from '@swrlab/utils/packages/ard/index.js'
import { createSandbox } from 'sinon'
import { coreIdPrefixes, pubSubPrefix } from '#config'
import { publisherLookup } from '../ard-core.ts'
import { processServices } from './process-services.ts'

const INSTITUTION_ID = 'urn:ard:institution:swr'
const PUBLISHER_URN = 'urn:ard:publisher:abcdef0123456789'

const user = {
	email: 'lab@swr.de',
	institution: { id: INSTITUTION_ID, name: 'SWR' },
} as AuthUser

/**
 * Build a minimal service for processServices tests.
 * @param overrides - Fields to merge onto the default service
 * @returns Service input
 */
const makeService = (overrides: Partial<EventhubService> = {}): EventhubService => ({
	type: 'PermanentLivestream',
	externalId: 'ext-1',
	publisherId: PUBLISHER_URN,
	...overrides,
})

/**
 * Stub publisher lookup to return a publisher for the given institution.
 * @param institutionId - Institution id attached to the stubbed publisher
 * @returns Sinon sandbox (caller must restore)
 */
const stubPublisher = (institutionId: string = INSTITUTION_ID) => {
	const sandbox = createSandbox()
	sandbox.stub(publisherLookup, 'getById').callsFake(
		(publisherId: string) =>
			({
				id: publisherId,
				title: 'Probe Station',
				institution: { id: institutionId, title: 'SWR' },
			}) as ArdPublisher
	)
	return sandbox
}

test('processServices sets topic id and pubsub name for an authorized publisher', async () => {
	const sandbox = stubPublisher()
	try {
		const service = makeService()
		const result = await processServices(service, {
			user,
			eventName: 'de.ard.eventhub.v1.radio.track.playing',
		})

		const expectedTopicId = `${coreIdPrefixes.PermanentLivestream}${createHashedId('ext-1')}`
		assertEquals(result.blocked, undefined)
		assertEquals(result.publisherId, PUBLISHER_URN)
		assertEquals(result.topic?.id, expectedTopicId)
		assertEquals(result.topic?.name, `${pubSubPrefix}${encodeURIComponent(expectedTopicId)}`)
	} finally {
		sandbox.restore()
	}
})

test('processServices prefixes radio-text topic ids for radio.text events', async () => {
	const sandbox = stubPublisher()
	try {
		const result = await processServices(makeService(), {
			user,
			eventName: 'de.ard.eventhub.v1.radio.text',
		})

		assertExists(result.topic?.id)
		assertEquals(result.topic.id.startsWith(`radio-text:${coreIdPrefixes.PermanentLivestream}`), true)
	} finally {
		sandbox.restore()
	}
})

test('processServices hashes legacy publisher ids into ARD URNs', async () => {
	const sandbox = stubPublisher()
	try {
		const result = await processServices(makeService({ publisherId: 'legacy-pub' }), {
			user,
			eventName: 'de.ard.eventhub.v1.radio.track.playing',
		})

		assertEquals(result.publisherId, `${coreIdPrefixes.Publisher}${createHashedId('legacy-pub')}`)
		assertEquals(result.blocked, undefined)
	} finally {
		sandbox.restore()
	}
})

test('processServices blocks when the publisher is unknown', async () => {
	const sandbox = createSandbox()
	sandbox.stub(publisherLookup, 'getById').returns(undefined)

	try {
		const result = await processServices(makeService(), {
			user,
			eventName: 'de.ard.eventhub.v1.radio.track.playing',
		})

		assertEquals(result.blocked, `Publisher not found > ${PUBLISHER_URN}`)
		assertExists(result.topic)
	} finally {
		sandbox.restore()
	}
})

test('processServices blocks when the user institution does not match the publisher', async () => {
	const sandbox = stubPublisher('urn:ard:institution:other')
	try {
		const result = await processServices(makeService(), {
			user,
			eventName: 'de.ard.eventhub.v1.radio.track.playing',
		})

		assertEquals(result.blocked, 'User unauthorized for service')
	} finally {
		sandbox.restore()
	}
})
