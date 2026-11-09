import type { ArdFeed, ArdLivestream, KnownLivestream } from '#types'
import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import allowedLivestreamsJson from '../../config/allowed-livestreams.json' with { type: 'json' }
import { allowedLivestreamsConfig } from '../../schemas/config.ts'
import { knownLivestreams, livestreamOwners } from './known-livestreams.ts'

const overlay = allowedLivestreamsConfig.parse(allowedLivestreamsJson)
const overlayIds = new Set(overlay.livestreams.map((entry) => entry.id))
const overlayPublisherIds = new Set(overlay.livestreams.flatMap((entry) => entry.publisherIds))

/**
 * Livestream URN that is not an allow-listed topic.
 * @param suffix - Disambiguator
 * @returns URN absent from the allow-list
 */
const feedLivestreamId = (suffix: string): string => {
	let id = `urn:ard:permanent-livestream:fixture-${suffix}`
	while (overlayIds.has(id)) id = `${id}-x`
	return id
}

/**
 * Publisher URN that is not on the allow-list.
 * @param suffix - Disambiguator
 * @returns URN absent from every allow-listed publisherIds
 */
const feedPublisherId = (suffix: string): string => {
	let id = `urn:ard:publisher:fixture-${suffix}`
	while (overlayPublisherIds.has(id)) id = `${id}-x`
	return id
}

/**
 * Allow-listed publisher pairs that should appear as overlay rows.
 * A topic already present as a feed externalId contributes none.
 * @param seenIds - Livestream URNs already on the feed
 * @returns Sorted `id` + publisher id pairs
 */
const overlayPairs = (seenIds: ReadonlySet<string>): string[] =>
	overlay.livestreams
		.filter((entry) => !seenIds.has(entry.id))
		.flatMap((entry) => entry.publisherIds.map((publisherId) => `${entry.id}\n${publisherId}`))
		.toSorted()

/**
 * Overlay rows as sorted id/publisher pairs.
 * @param rows - Catalog rows
 * @returns Sorted pairs for overlay rows only
 */
const actualOverlayPairs = (rows: readonly KnownLivestream[]): string[] =>
	rows
		.filter((entry) => entry.overlay)
		.map((entry) => `${entry.id}\n${entry.publisher.id}`)
		.toSorted()

/**
 * One feed item. `id` is the fusion URN. `externalId` is the livestream URN.
 * @param externalId - Livestream URN
 * @param title - Livestream title
 * @param publisherId - Publisher URN
 * @param publisher - Publisher title
 * @param institutionId - Institution URN
 * @param institution - Institution title
 * @returns Minimal livestream
 */
const item = (
	externalId: string,
	title: string,
	publisherId: string,
	publisher: string,
	institutionId: string,
	institution: string
): ArdLivestream =>
	({
		id: `urn:ard:permanent-livestream-fusion:${externalId.slice(-6)}`,
		externalId,
		title,
		publisher: {
			id: publisherId,
			title: publisher,
			institution: { id: institutionId, title: institution, acronym: 'SWR' },
		},
	}) as ArdLivestream

test('knownLivestreams uses externalId and nests publisher and institution', () => {
	const topic = overlay.livestreams.find((entry) => entry.publisherIds[0])
	const publisherId = topic?.publisherIds[0] ?? feedPublisherId('daytime')
	const feedId = feedLivestreamId('daytime')
	const institution = { id: 'urn:ard:institution:house', title: 'House' }
	const feed = {
		items: [item(feedId, 'Daytime', publisherId, 'Daytime Station', institution.id, institution.title)],
	} as ArdFeed
	const rows = knownLivestreams(feed)
	const daytime = rows.find((entry) => entry.id === feedId)

	assertEquals(daytime?.overlay, false)
	assertEquals(daytime?.id.startsWith('urn:ard:permanent-livestream-fusion:'), false)
	assertEquals(daytime?.publisher, { id: publisherId, title: 'Daytime Station' })
	assertEquals(daytime?.institution, institution)
	assertEquals(actualOverlayPairs(rows), overlayPairs(new Set([feedId])))
	const overlayStart = rows.findIndex((entry) => entry.overlay)
	assertEquals(
		rows.slice(overlayStart === -1 ? rows.length : overlayStart).every((entry) => entry.overlay),
		true
	)
	assertEquals(rows[0]?.overlay, false)

	if (!topic) return
	const copied = rows.find((entry) => entry.id === topic.id && entry.publisher.id === publisherId)
	assertEquals(copied?.overlay, true)
	assertEquals(copied?.title, topic.name)
	assertEquals(copied?.publisher, { id: publisherId, title: 'Daytime Station' })
	assertEquals(copied?.institution, institution)
})

test('knownLivestreams keeps a feed row when its externalId is also an overlay topic', () => {
	const topic = overlay.livestreams[0]
	if (!topic) return
	const publisherId = feedPublisherId('feed-only')
	const feed = {
		items: [item(topic.id, 'From the feed', publisherId, 'Feed Station', 'urn:ard:institution:house', 'House')],
	} as ArdFeed
	const rows = knownLivestreams(feed)
	const matches = rows.filter((entry) => entry.id === topic.id)

	assertEquals(matches.length, 1)
	assertEquals(matches[0]?.overlay, false)
	assertEquals(matches[0]?.title, 'From the feed')
	assertEquals(matches[0]?.publisher.id, publisherId)
	assertEquals(actualOverlayPairs(rows), overlayPairs(new Set([topic.id])))
})

test('knownLivestreams skips a feed item with no externalId', () => {
	const topic = overlay.livestreams.find((entry) => entry.publisherIds[0])
	const publisherId = topic?.publisherIds[0] ?? feedPublisherId('missing')
	const feed = {
		items: [
			{
				id: 'urn:ard:permanent-livestream-fusion:missing',
				title: 'No external id',
				publisher: {
					id: publisherId,
					title: 'Listed Station',
					institution: { id: 'urn:ard:institution:house', title: 'House', acronym: 'SWR' },
				},
			} as ArdLivestream,
		],
	} as ArdFeed
	const rows = knownLivestreams(feed)

	assertEquals(
		rows.some((entry) => entry.title === 'No external id'),
		false
	)
	assertEquals(
		rows.some((entry) => !entry.overlay),
		false
	)
	assertEquals(actualOverlayPairs(rows), overlayPairs(new Set()))
	if (!topic) return
	const copied = rows.find((entry) => entry.id === topic.id && entry.publisher.id === publisherId)
	assertEquals(copied?.publisher.title, 'Listed Station')
	assertEquals(copied?.institution, { id: 'urn:ard:institution:house', title: 'House' })
})

test('livestreamOwners indexes a loaded feed and is null when none is loaded', () => {
	assertEquals(livestreamOwners(null), null)
	const feedId = feedLivestreamId('owners')
	const publisherId = feedPublisherId('owners')
	const institutionId = 'urn:ard:institution:house'
	const feed = {
		items: [item(feedId, 'Daytime', publisherId, 'SWR3', institutionId, 'SWR')],
	} as ArdFeed
	const owners = livestreamOwners(feed)
	assertEquals(owners?.get(feedId), [{ publisherId, institutionId }])
	for (const entry of overlay.livestreams) assertEquals(owners?.has(entry.id), false)
	assertEquals(livestreamOwners(feed), owners)
})

test('knownLivestreams lists one overlay row per allowed publisher when no feed is loaded', () => {
	const rows = knownLivestreams(null)
	assertEquals(actualOverlayPairs(rows), overlayPairs(new Set()))
	assertEquals(
		rows.every((entry) => entry.overlay && entry.institution === null && entry.publisher.title === ''),
		true
	)
	for (const entry of overlay.livestreams) {
		for (const publisherId of entry.publisherIds) {
			assertEquals(rows.find((row) => row.id === entry.id && row.publisher.id === publisherId)?.title, entry.name)
		}
	}
})
