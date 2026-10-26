import type { EventhubPluginMessage, EventhubService } from '../../../schemas/events.ts'
import { test } from '@cross/test'
import { logger } from '@frytg/logger'
import { assert, assertEquals, assertExists, assertStringIncludes } from '@std/assert'
import { createSandbox } from 'sinon'
import { coreIdPrefixes } from '#config'
import { radioplayerAPIKeys } from '#env'
import { radioplayerEvent, radioplayerHttp } from './event.ts'

/** SWR4 Karlsruhe. Mapped in `src/config/radioplayer-mapping.json5`. */
const PERMANENT_LIVESTREAM_ID = 'urn:ard:permanent-livestream:a754229c1632f361'
const EVENT_LIVESTREAM_ID = `${coreIdPrefixes.EventLivestream}abc123def4567890`
const MAPPED_RPUID = '276505'

const institutionId = Object.keys(radioplayerAPIKeys)[0] ?? ''
const plugin = { type: 'radioplayer', isDeactivated: false }

/**
 * Plugin job for one service.
 * @param service - Service entry on the event
 * @returns Radioplayer plugin message
 */
const makeJob = (service: EventhubService): EventhubPluginMessage => ({
	action: 'plugins.radioplayer.event',
	institutionId,
	plugin,
	event: {
		event: 'de.ard.eventhub.v1.radio.track.playing',
		name: 'de.ard.eventhub.v1.radio.track.playing',
		type: 'music',
		start: '2026-10-26T18:09:16.000Z',
		title: 'Take that look off your face',
		artist: 'Marti Webb',
		length: 174,
		playlistItemId: 'item-1',
		services: [service],
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
		created: '2026-10-26T18:09:20.487Z',
		id: 'event-1',
	},
})

/**
 * Service identified by a livestream URN.
 * @param id - Livestream URN (`service.topic.id` and `service.id`)
 * @param type - Deprecated `service.type`, omitted when unset
 * @returns Service entry
 */
const makeService = (id: string, type?: string): EventhubService => ({
	id,
	publisherId: 'urn:ard:publisher:testpublisher0001',
	topic: { id, name: 'topic' },
	...(type ? { type } : {}),
})

/**
 * Stub logging and the Radioplayer HTTP client so a test cannot reach the live ingest.
 * @returns Sinon sandbox (caller must restore)
 */
const stubIo = () => {
	const sandbox = createSandbox()
	sandbox.stub(logger, 'log')
	sandbox.stub(logger, 'warning')
	sandbox.stub(radioplayerHttp, 'post').resolves(new Response('ok', { status: 200 }))
	return sandbox
}

test('radioplayer forwards a permanent livestream identified only by its URN', async () => {
	assert(institutionId.length > 0)
	const sandbox = stubIo()

	try {
		const result = await radioplayerEvent(makeJob(makeService(PERMANENT_LIVESTREAM_ID)))

		assertExists(result)
		assertEquals(result.length, 1)
		assertStringIncludes(result[0]?.url ?? '', `rpuid=${MAPPED_RPUID}`)
	} finally {
		sandbox.restore()
	}
})

test('radioplayer skips an event livestream when service.type is PermanentLivestream', async () => {
	assert(institutionId.length > 0)
	const sandbox = stubIo()

	try {
		const result = await radioplayerEvent(makeJob(makeService(EVENT_LIVESTREAM_ID, 'PermanentLivestream')))

		assertEquals(result, [])
	} finally {
		sandbox.restore()
	}
})
