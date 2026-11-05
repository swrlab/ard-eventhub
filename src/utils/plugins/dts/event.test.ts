import type { EventhubPluginMessage, EventhubService } from '../../../schemas/events.ts'
import { test } from '@cross/test'
import { logger } from '@frytg/logger'
import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import { createSandbox } from 'sinon'
import { dtsKeys } from '#env'
import { dtsEvent } from './event.ts'

const TOPIC_ID = 'urn:ard:permanent-livestream:0000000000000001'
const institutionId = dtsKeys.credentials.liveradio[0]?.coreId ?? ''
const plugin = { type: 'dts', isDeactivated: false }

/**
 * Plugin job for the given services.
 * @param services - Service entries on the event
 * @returns DTS plugin message
 */
const makeJob = (services: EventhubService[]): EventhubPluginMessage => ({
	action: 'plugins.dts.event',
	institutionId,
	plugin,
	event: {
		event: 'de.ard.eventhub.v1.radio.track.playing',
		name: 'de.ard.eventhub.v1.radio.track.playing',
		type: 'music',
		start: '2026-10-26T18:30:23.000Z',
		title: 'Hola, hola',
		artist: 'Semino Rossi',
		length: 180,
		playlistItemId: 'item-1',
		services,
		contributors: [],
		references: [],
		hfdbIds: [],
		externalId: 'ext-1',
		isrc: null,
		upc: null,
		mpn: null,
		media: [],
		plugins: [plugin],
		creator: 'lab@example.test',
		created: '2026-10-26T18:30:27.156Z',
		id: 'event-1',
	},
})

/**
 * Service with a livestream topic id DTS can post.
 * @param id - Livestream URN (`service.topic.id`)
 * @returns Service entry
 */
const makeService = (id: string): EventhubService => ({
	id,
	publisherId: 'urn:ard:publisher:testpublisher0001',
	topic: { id, name: 'topic' },
})

/**
 * Stub logging and fetch so a test cannot reach the live DTS API.
 * @returns Sinon sandbox (caller must restore) plus the fetch and warning stubs
 */
const stubIo = () => {
	const sandbox = createSandbox()
	sandbox.stub(logger, 'log')
	const warning = sandbox.stub(logger, 'warning')
	sandbox.stub(logger, 'error')
	const fetchStub = sandbox.stub(globalThis, 'fetch').resolves(new Response('{}', { status: 200 }))
	return { sandbox, fetchStub, warning }
}

test('dts does not post when the event has no core ids', async () => {
	assert(institutionId.length > 0)
	const { sandbox, fetchStub, warning } = stubIo()

	try {
		await dtsEvent(makeJob([]))
		await dtsEvent(makeJob([{ publisherId: 'urn:ard:publisher:testpublisher0001' }]))

		assertEquals(fetchStub.called, false)
		assertEquals(warning.callCount, 2)
		assertStringIncludes(String(warning.firstCall.args[0]?.message), 'dts skipping event no core ids')
		assertStringIncludes(String(warning.secondCall.args[0]?.message), 'dts skipping event no core ids')
	} finally {
		sandbox.restore()
	}
})

test('dts posts one liveradio event per core id', async () => {
	assert(institutionId.length > 0)
	const { sandbox, fetchStub } = stubIo()

	try {
		await dtsEvent(makeJob([makeService(TOPIC_ID)]))

		assertEquals(fetchStub.calledOnce, true)
		const init = fetchStub.firstCall.args[1]
		const body = JSON.parse(String(init?.body)) as { publisherSourceId?: string }[]
		assertEquals(body.length, 1)
		assertEquals(body[0]?.publisherSourceId, TOPIC_ID)
	} finally {
		sandbox.restore()
	}
})
