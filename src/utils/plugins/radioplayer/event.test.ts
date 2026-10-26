import type { EventhubPluginMessage, EventhubService } from '../../../schemas/events.ts'
import { test } from '@cross/test'
import { logger } from '@frytg/logger'
import { assertEquals, assertExists, assertStringIncludes } from '@std/assert'
import { createSandbox } from 'sinon'
import { coreIdPrefixes } from '#config'
import { radioplayerAPIKeys } from '#env'
import { radioplayerEvent, radioplayerHttp } from './event.ts'

/** SWR4 Karlsruhe. Mapped in `src/config/radioplayer-mapping.json5`. */
const PERMANENT_LIVESTREAM_ID = 'urn:ard:permanent-livestream:a754229c1632f361'
const EVENT_LIVESTREAM_ID = `${coreIdPrefixes.EventLivestream}abc123def4567890`
const MAPPED_RPUID = '276505'

/** Fake institution. The key map from env may be empty, so the test installs its own entry. */
const institutionId = 'urn:ard:institution:0000000000000001'
const TEST_API_KEY = 'test-key'
const plugin = { type: 'radioplayer', isDeactivated: false }

/**
 * Install a fake API key so the handler gets past the credential check.
 * @returns Restore the previous map entry
 */
const installTestKey = (): (() => void) => {
	const previous = radioplayerAPIKeys[institutionId]
	radioplayerAPIKeys[institutionId] = TEST_API_KEY
	return () => {
		if (previous === undefined) {
			delete radioplayerAPIKeys[institutionId]
			return
		}
		radioplayerAPIKeys[institutionId] = previous
	}
}

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
	const sandbox = stubIo()
	const restoreKey = installTestKey()

	try {
		const result = await radioplayerEvent(makeJob(makeService(PERMANENT_LIVESTREAM_ID)))

		assertExists(result)
		assertEquals(result.length, 1)
		assertStringIncludes(result[0]?.url ?? '', `rpuid=${MAPPED_RPUID}`)
	} finally {
		restoreKey()
		sandbox.restore()
	}
})

test('radioplayer skips an event livestream when service.type is PermanentLivestream', async () => {
	const sandbox = stubIo()
	const restoreKey = installTestKey()

	try {
		const result = await radioplayerEvent(makeJob(makeService(EVENT_LIVESTREAM_ID, 'PermanentLivestream')))

		assertEquals(result, [])
	} finally {
		restoreKey()
		sandbox.restore()
	}
})
