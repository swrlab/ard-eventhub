/*
	ard-eventhub
	by SWR Audio Lab

	unit tests for the Radioplayer plugin

	this test file can be run manually and locally with `bun test src/utils/plugins/radioplayer/event.mantest.ts`
	it writes to the production system and therefore should be used sparingly
*/

import process from 'node:process'

// Must be set before any plugin imports (api-keys loads at import)
const testApiKeys = process.env.RADIOPLAYER_API_KEYS
process.env.RADIOPLAYER_API_KEYS = testApiKeys

import { test } from '@cross/test'
import { getISO } from '@frytg/dates'
import { assert, assertEquals, assertExists, assertGreater, assertStringIncludes } from '@std/assert'
import { radioplayerEvent } from './event.ts'

// Livestream URN that exists in config/radioplayer-mapping.json5
const MAPPED_LIVESTREAM_URN = 'urn:ard:permanent-livestream:b852cb677ac83775'
const TEST_INSTITUTION = 'urn:ard:institution:a3004ff924ece1a2'
const RUN_PRODUCTION_TESTS = process.env.RADIOPLAYER_RUN_TESTS === 'true'

/**
 * Build a radioplayer plugin job fixture.
 * @param overrides - Partial job fields to merge over defaults
 * @returns Job payload for `radioplayerEvent`
 */
const createJob = (overrides: Partial<Parameters<typeof radioplayerEvent>[0]> = {}) => {
	const plugin = { type: 'radioplayer', isDeactivated: false }
	return {
		action: 'plugins.radioplayer.event',
		event: {
			event: 'de.ard.eventhub.v1.radio.track.playing',
			name: 'de.ard.eventhub.v1.radio.track.playing',
			type: 'music',
			start: getISO() ?? '',
			title: 'Test Song',
			artist: 'Test Artist',
			length: 10,
			services: [
				{
					type: 'PermanentLivestream',
					externalId: 'crid://ard.de/test/unit',
					publisherId: 'urn:ard:publisher:test123',
					topic: {
						id: MAPPED_LIVESTREAM_URN,
						name: 'de.ard.eventhub.dev.test',
					},
				},
			],
			id: 'unit-test-id-123',
			externalId: 'unit-test-external-id-123',
			playlistItemId: 'unit-test-id-in-playlist-567',
			creator: 'unit-test@ard.de',
			created: getISO() ?? '',
			contributors: [],
			references: [],
			hfdbIds: [],
			isrc: null,
			upc: null,
			mpn: null,
			media: [],
			plugins: [plugin],
		},
		plugin,
		institutionId: TEST_INSTITUTION,
		...overrides,
	}
}

test(
	'Radioplayer plugin',
	async (t) => {
		if (RUN_PRODUCTION_TESTS) {
			await t.step('sends HTTP POST with artist and title when event is music and in mapping', async () => {
				const result = await radioplayerEvent(
					createJob({
						event: {
							...createJob().event,
							media: [
								{
									type: 'cover',
									url: 'https://cdn-static.lab.swr.de/images/v1/get/swr-cover-jingle/img.jpg',
									templateUrl: null,
									description: 'SWR Cover Test',
									attribution: 'SWR',
								},
							],
						},
					})
				)

				assertExists(result)
				assert(Array.isArray(result))
				assertGreater(result.length, 0)
				for (const resultItem of result as NonNullable<{ url: string }[]>) {
					assertStringIncludes(resultItem.url, 'https://')
					assertStringIncludes(resultItem.url, 'np-ingest.radioplayer.cloud')
					assertStringIncludes(resultItem.url, 'rpuid=2761425')
					assertStringIncludes(resultItem.url, 'artist=Test+Artist')
					assertStringIncludes(resultItem.url, 'title=Test+Song')
					assertStringIncludes(resultItem.url, 'startTime=')
					assertStringIncludes(resultItem.url, 'duration=10')
				}
			})
		}

		await t.step('skips non-playing events', async () => {
			const result = await radioplayerEvent(
				createJob({
					event: {
						...createJob().event,
						name: 'de.ard.eventhub.v1.radio.track.next',
					},
				})
			)

			assertEquals(result, null)
		})

		await t.step('skips non-music events', async () => {
			const result = await radioplayerEvent(
				createJob({
					event: {
						...createJob().event,
						type: 'advertisement',
					},
				})
			)

			assertEquals(result, null)
		})

		await t.step('skips when institution has no API key', async () => {
			const result = await radioplayerEvent(
				createJob({
					institutionId: 'urn:ard:institution:unknown',
				})
			)

			assertEquals(result, null)
		})

		await t.step('skips services not in mapping', async () => {
			const result = await radioplayerEvent(
				createJob({
					event: {
						...createJob().event,
						services: [
							{
								type: 'PermanentLivestream',
								externalId: 'crid://ard.de/test/unit',
								publisherId: 'urn:ard:publisher:test123',
								topic: {
									id: 'urn:ard:permanent-livestream:unknown12345678',
									name: 'de.ard.eventhub.dev.unknown',
								},
							},
						],
					},
				})
			)

			assertEquals(result, [])
		})

		await t.step('skips non-PermanentLivestream services', async () => {
			const result = await radioplayerEvent(
				createJob({
					event: {
						...createJob().event,
						services: [
							{
								type: 'EventLivestream',
								externalId: 'crid://ard.de/test/unit',
								publisherId: 'urn:ard:publisher:test123',
								topic: {
									id: 'urn:ard:event-livestream:abc123',
									name: 'de.ard.eventhub.dev.event',
								},
							},
						],
					},
				})
			)

			assertEquals(result, [])
		})

		await t.step('skips services without livestream ID', async () => {
			const result = await radioplayerEvent(
				createJob({
					event: {
						...createJob().event,
						services: [
							{
								type: 'PermanentLivestream',
								externalId: 'crid://ard.de/test/unit',
								publisherId: 'urn:ard:publisher:test123',
								topic: { id: '', name: '' },
							},
						],
					},
				})
			)

			assertEquals(result, [])
		})
	},
	{ skip: true }
)
