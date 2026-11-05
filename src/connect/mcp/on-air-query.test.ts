import type { KnownLivestream, OnAirStation } from '#types'
import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { selectOnAir } from './on-air-query.ts'

const SWR3 = 'urn:ard:permanent-livestream:swr3'
const SWR1 = 'urn:ard:permanent-livestream:swr1'
const WDR2 = 'urn:ard:permanent-livestream:wdr2'

const catalog: KnownLivestream[] = [
	{
		id: SWR3,
		title: 'SWR3',
		publisher: { id: 'urn:ard:publisher:swr3', title: 'SWR3' },
		institution: { id: 'urn:ard:institution:swr', title: 'Südwestrundfunk' },
		overlay: false,
	},
	{
		id: SWR1,
		title: 'SWR1',
		publisher: { id: 'urn:ard:publisher:swr1', title: 'SWR1 BW' },
		institution: { id: 'urn:ard:institution:swr', title: 'Südwestrundfunk' },
		overlay: false,
	},
	{
		id: WDR2,
		title: 'WDR 2',
		publisher: { id: 'urn:ard:publisher:wdr2', title: 'WDR 2' },
		institution: { id: 'urn:ard:institution:wdr', title: 'Westdeutscher Rundfunk' },
		overlay: false,
	},
]

/**
 * One retained station. Titles stay empty until the lookup copies them from the feed.
 * @param livestreamId - Livestream URN
 * @param at - Observation time
 * @param title - Playing title
 * @param publisherId - Publisher URN on the payload
 * @returns A station row
 */
const playing = (livestreamId: string, at: string, title: string, publisherId: string): OnAirStation => ({
	livestreamId,
	institutionId: null,
	institutionTitle: null,
	publisherTitle: null,
	lastEventAt: at,
	playing: { title, artist: 'Artist', publisherId, at },
	next: null,
	control: null,
	data: null,
})

const live = [
	playing(SWR3, '2026-10-09T10:00:00.000Z', 'Current', 'urn:ard:publisher:swr3'),
	playing(WDR2, '2026-10-09T09:00:00.000Z', 'Other', 'urn:ard:publisher:wdr2'),
]

test('a publisher URN returns that livestream and its feed title', () => {
	const selected = selectOnAir(live, catalog, { publisher: 'urn:ard:publisher:swr3', institution: null })
	assertEquals(
		selected.stations.map((station) => station.livestreamId),
		[SWR3]
	)
	assertEquals(selected.stations[0]?.title, 'SWR3')
	assertEquals(selected.stations[0]?.playing?.title, 'Current')
	assertEquals(selected.stations[0]?.publisherId, 'urn:ard:publisher:swr3')
	assertEquals(selected.stations[0]?.institutionTitle, 'Südwestrundfunk')
	assertEquals(selected.note, null)
})

test('an institution title returns every station of that house, quiet ones last', () => {
	const selected = selectOnAir(live, catalog, { publisher: null, institution: 'südwestrundfunk' })
	assertEquals(
		selected.stations.map((station) => station.livestreamId),
		[SWR3, SWR1]
	)
	assertEquals(selected.stations[1]?.playing, null)
	assertEquals(selected.stations[1]?.publisherTitle, 'SWR1 BW')
	assertEquals(selected.note, null)
})

test('a title fragment matches publisher titles and does not cross houses', () => {
	const selected = selectOnAir(live, catalog, { publisher: 'swr', institution: null })
	assertEquals(
		selected.stations.map((station) => station.livestreamId),
		[SWR3, SWR1]
	)
})

test('a URN that is not exact does not match a longer id', () => {
	const selected = selectOnAir(live, catalog, { publisher: 'urn:ard:publisher:swr', institution: null })
	assertEquals(selected.stations, [])
	assertEquals(selected.note, 'no livestream for this publisher or institution')
})

test('publisher and institution both have to match', () => {
	const selected = selectOnAir(live, catalog, { publisher: 'SWR3', institution: 'Westdeutscher Rundfunk' })
	assertEquals(selected.stations, [])
})

test('a livestream missing from the feed still matches the payload publisher', () => {
	const orphan = 'urn:ard:permanent-livestream:orphan'
	const selected = selectOnAir(
		[playing(orphan, '2026-10-09T11:00:00.000Z', 'Loose', 'urn:ard:publisher:loose')],
		catalog,
		{ publisher: 'urn:ard:publisher:loose', institution: null }
	)
	assertEquals(selected.stations[0]?.livestreamId, orphan)
	assertEquals(selected.stations[0]?.title, null)
	assertEquals(selected.stations[0]?.playing?.title, 'Loose')
})

test('a house with only quiet stations says nothing is retained', () => {
	const selected = selectOnAir([], catalog, { publisher: null, institution: 'urn:ard:institution:swr' })
	assertEquals(selected.stations.length, 2)
	assertEquals(selected.note, 'nothing retained for this publisher or institution')
})

test('omitting both sides returns nothing', () => {
	const selected = selectOnAir(live, catalog, { publisher: null, institution: '  ' })
	assertEquals(selected.stations, [])
	assertEquals(selected.note, 'publisher or institution is required')
})
