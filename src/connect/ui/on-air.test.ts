import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { foldOnAir, nameOnAirStations, parseRadioSubject } from './on-air.ts'

const LIVESTREAM = 'urn:ard:permanent-livestream:49267f7d67be180d'

test('radio subjects split into livestream id and event class', () => {
	assertEquals(parseRadioSubject(`radio.${LIVESTREAM}.track.playing`)?.eventClass, 'track.playing')
	assertEquals(parseRadioSubject(`radio.${LIVESTREAM}.control`)?.livestreamId, LIVESTREAM)
	assertEquals(parseRadioSubject('inbox.urn:ard:institution:abc'), null)
})

test('on-air rows sort quietest first and keep the latest control and radiotext', () => {
	const quiet = 'urn:ard:permanent-livestream:aaaaaaaaaaaaaaaa'
	const fresh = 'urn:ard:permanent-livestream:bbbbbbbbbbbbbbbb'
	const stations = foldOnAir([
		{
			subject: `radio.${fresh}.track.playing`,
			at: '2026-10-08T10:00:00.000Z',
			payload: {
				title: 'Fresh',
				artist: 'A',
				services: [{ publisherId: 'urn:ard:publisher:1', institutionId: 'urn:ard:institution:house' }],
			},
		},
		{
			subject: `radio.${quiet}.track.playing`,
			at: '2026-10-08T08:00:00.000Z',
			payload: { title: 'Old', artist: null },
		},
		{
			subject: `radio.${quiet}.track.playing`,
			at: '2026-10-08T09:00:00.000Z',
			payload: { title: 'Newer old', artist: 'B' },
		},
		{
			subject: `radio.${quiet}.control`,
			at: '2026-10-08T09:01:00.000Z',
			payload: { name: 'TA', state: true, validUntil: '2026-10-08T09:02:00.000Z' },
		},
		{
			subject: `radio.${quiet}.data`,
			at: '2026-10-08T09:01:30.000Z',
			payload: { data: [{ type: 'radiotext', value: 'news' }] },
		},
		{
			subject: `radio.${quiet}.track.next`,
			at: '2026-10-08T09:00:30.000Z',
			payload: { title: 'After', artist: 'C' },
		},
	])
	assertEquals(
		stations.map((station) => station.livestreamId),
		[quiet, fresh]
	)
	const first = stations[0]
	assertEquals(first?.playing?.title, 'Newer old')
	assertEquals(first?.next?.title, 'After')
	assertEquals(first?.control?.name, 'TA')
	assertEquals(first?.control?.state, true)
	assertEquals(first?.data?.text, 'news')
	assertEquals(first?.lastEventAt, '2026-10-08T09:01:30.000Z')
	assertEquals(stations[1]?.playing?.publisherId, 'urn:ard:publisher:1')
	assertEquals(stations[1]?.institutionId, 'urn:ard:institution:house')
	assertEquals(stations[1]?.publisherTitle, null)
	assertEquals(stations[1]?.institutionTitle, null)
})

test('feed titles land on the matching livestream and stay empty otherwise', () => {
	const known = 'urn:ard:permanent-livestream:aaaaaaaaaaaaaaaa'
	const unknown = 'urn:ard:permanent-livestream:bbbbbbbbbbbbbbbb'
	const named = nameOnAirStations(
		foldOnAir([
			{ subject: `radio.${known}.track.playing`, at: '2026-10-08T10:00:00.000Z', payload: { title: 'A' } },
			{ subject: `radio.${unknown}.track.playing`, at: '2026-10-08T10:00:00.000Z', payload: { title: 'B' } },
		]),
		[
			{
				id: known,
				title: 'SWR3',
				publisher: { id: 'urn:ard:publisher:1', title: 'SWR3' },
				institution: { id: 'urn:ard:institution:house', title: 'Südwestrundfunk' },
				overlay: false,
			},
			{
				id: 'urn:ard:permanent-livestream:cccccccccccccccc',
				title: 'Overlay',
				publisher: { id: 'urn:ard:publisher:2', title: '' },
				institution: null,
				overlay: true,
			},
		]
	)
	assertEquals(named[0]?.publisherTitle, 'SWR3')
	assertEquals(named[0]?.institutionTitle, 'Südwestrundfunk')
	assertEquals(named[1]?.publisherTitle, null)
	assertEquals(named[1]?.institutionTitle, null)
})
