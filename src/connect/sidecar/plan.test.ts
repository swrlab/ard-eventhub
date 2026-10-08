import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { parseRejection } from '../ui/rejections.ts'
import { planInboxMessage } from './plan.ts'

const SUBJECT_INSTITUTION = 'urn:ard:institution:a3004ff924ece1a2'
const OTHER = 'urn:ard:institution:b71c0e4d9a25f338'
const LIVESTREAM = 'urn:ard:permanent-livestream:49267f7d67be180d'
const PUBLISHER = 'urn:ard:publisher:75dbb3dace15f610'
const INBOX = `inbox.${SUBJECT_INSTITUTION}`
const AT = '2026-10-08T12:00:00.000Z'

const owners = new Map([[LIVESTREAM, { publisherId: PUBLISHER, institutionId: SUBJECT_INSTITUTION }]])

const track = {
	event: 'de.ard.eventhub.v1.radio.track.playing',
	type: 'music',
	start: '2026-10-08T12:00:00+02:00',
	length: 180,
	title: 'Song',
	playlistItemId: 'item-1',
	services: [{ id: LIVESTREAM, publisherId: PUBLISHER, institutionId: SUBJECT_INSTITUTION }],
}

/**
 * Plan one JSON payload.
 * @param body - JSON value
 * @param subject - Inbox subject
 * @param feedOwners - Owner index, or null when no feed is loaded
 * @returns The plan
 */
const plan = (body: unknown, subject = INBOX, feedOwners: typeof owners | null = owners) =>
	planInboxMessage({
		subject,
		bytes: new TextEncoder().encode(JSON.stringify(body)),
		owners: feedOwners,
		at: AT,
	})

test('a valid music now-playing event is retained and fanned out without an explicit plugin', () => {
	const result = plan(track)
	assertEquals(result.action, 'ack')
	assertEquals(
		result.mqtt.map((item) => item.topic),
		[`radio/${LIVESTREAM}/track/playing`]
	)
	assertEquals(result.mqtt[0]?.retain, true)
	assertEquals(
		result.nats.map((item) => item.subject),
		[`plugin.dts.${LIVESTREAM}.track.playing`, `plugin.radioplayer.${LIVESTREAM}.track.playing`]
	)
})

test('a schema failure is feedback the rejections board can read', () => {
	const result = plan({ ...track, title: undefined })
	assertEquals(result.action, 'term')
	assertEquals(result.reason, 'schema')
	assertEquals(result.nats, [])
	const body = result.mqtt[0]?.body
	const row = parseRejection(JSON.stringify(body), `feedback.${SUBJECT_INSTITUTION}`, AT)
	assertEquals(row.cause, 'schema')
	assertEquals(row.playlistItemId, 'item-1')
	assertEquals(row.institutionId, SUBJECT_INSTITUTION)
	assertEquals(row.message.length > 0, true)
})

test('a mismatched institution is rejected even when the subject itself is well formed', () => {
	const result = plan({
		...track,
		services: [{ id: LIVESTREAM, publisherId: PUBLISHER, institutionId: OTHER }],
	})
	assertEquals(result.action, 'term')
	assertEquals(result.reason, 'ownership')
	const body = result.mqtt[0]?.body as { disagreed?: string[]; message?: string }
	assertEquals(body.disagreed, ['subject', 'payload', 'feed'])
	assertEquals(body.message?.includes('inbox subject'), true)
})

test('an unknown livestream is an ownership rejection', () => {
	const missing = 'urn:ard:permanent-livestream:0000000000000000'
	const result = plan({
		...track,
		services: [{ id: missing, publisherId: PUBLISHER, institutionId: SUBJECT_INSTITUTION }],
	})
	assertEquals(result.reason, 'ownership')
	const body = result.mqtt[0]?.body as { disagreed?: string[] }
	assertEquals(body.disagreed, ['feed'])
})

test('a missing feed nak waits instead of terming a valid event', () => {
	const result = plan(track, INBOX, null)
	assertEquals(result.action, 'nak')
	assertEquals(result.reason, 'feed')
	assertEquals(result.mqtt, [])
})

test('track.next is retained and does not fan out when no plugin is set', () => {
	const result = plan({ ...track, event: 'de.ard.eventhub.v1.radio.track.next' })
	assertEquals(result.action, 'ack')
	assertEquals(
		result.mqtt.map((item) => item.topic),
		[`radio/${LIVESTREAM}/track/next`]
	)
	assertEquals(result.nats, [])
})
