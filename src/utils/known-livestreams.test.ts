import type { ArdFeed, ArdLivestream } from '#types'
import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { knownLivestreams } from './known-livestreams.ts'

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
	const feed = {
		items: [
			item(
				'urn:ard:permanent-livestream:aaa',
				'Daytime',
				'urn:ard:publisher:a8aa147108ee961a',
				'SWR1',
				'urn:ard:institution:house',
				'Südwestrundfunk'
			),
		],
	} as ArdFeed
	const rows = knownLivestreams(feed)
	const daytime = rows.find((entry) => entry.id === 'urn:ard:permanent-livestream:aaa')
	const musikclub = rows.find((entry) => entry.id === 'urn:ard:permanent-livestream:7c0dd5c9f90b67ab')
	assertEquals(daytime?.overlay, false)
	assertEquals(daytime?.id.startsWith('urn:ard:permanent-livestream-fusion:'), false)
	assertEquals(daytime?.publisher, { id: 'urn:ard:publisher:a8aa147108ee961a', title: 'SWR1' })
	assertEquals(daytime?.institution, { id: 'urn:ard:institution:house', title: 'Südwestrundfunk' })
	assertEquals(musikclub?.overlay, true)
	assertEquals(musikclub?.title, 'ARD Musikclub')
	assertEquals(musikclub?.publisher, { id: 'urn:ard:publisher:a8aa147108ee961a', title: 'SWR1' })
	assertEquals(musikclub?.institution, { id: 'urn:ard:institution:house', title: 'Südwestrundfunk' })
	assertEquals(rows.filter((entry) => entry.overlay).length, 5)
	assertEquals(rows[0]?.overlay, false)
})

test('knownLivestreams keeps a feed row when its externalId is also an overlay topic', () => {
	const feed = {
		items: [
			item(
				'urn:ard:permanent-livestream:7c0dd5c9f90b67ab',
				'ARD Musikclub',
				'urn:ard:publisher:a8aa147108ee961a',
				'SWR1',
				'urn:ard:institution:house',
				'Südwestrundfunk'
			),
		],
	} as ArdFeed
	const rows = knownLivestreams(feed)
	const musikclub = rows.filter((entry) => entry.id === 'urn:ard:permanent-livestream:7c0dd5c9f90b67ab')
	assertEquals(musikclub.length, 1)
	assertEquals(musikclub[0]?.overlay, false)
	assertEquals(rows.filter((entry) => entry.overlay).length, 4)
})

test('knownLivestreams skips a feed item with no externalId', () => {
	const feed = {
		items: [
			{
				id: 'urn:ard:permanent-livestream-fusion:missing',
				title: 'No external id',
				publisher: {
					id: 'urn:ard:publisher:a8aa147108ee961a',
					title: 'SWR1',
					institution: { id: 'urn:ard:institution:house', title: 'Südwestrundfunk', acronym: 'SWR' },
				},
			} as ArdLivestream,
		],
	} as ArdFeed
	const rows = knownLivestreams(feed)
	assertEquals(
		rows.some((entry) => entry.title === 'No external id'),
		false
	)
	assertEquals(rows.filter((entry) => entry.overlay).length, 5)
	assertEquals(
		rows.find((entry) => entry.publisher.id === 'urn:ard:publisher:a8aa147108ee961a')?.publisher.title,
		'SWR1'
	)
})

test('knownLivestreams still lists the overlay when no feed is loaded', () => {
	const rows = knownLivestreams(null)
	assertEquals(rows.length, 5)
	assertEquals(
		rows.every((entry) => entry.overlay && entry.institution === null && entry.publisher.title === ''),
		true
	)
	assertEquals(rows[0]?.publisher.id.length > 0, true)
})
