import type { ValidationAccept, ValidationPlan, ValidationReject } from '#types'
import { test } from '@cross/test'
import { assertEquals, assertThrows } from '@std/assert'
import { serveTestFeed } from '../feed/test-feed.ts'
import { parseRejection } from '../ui/rejections.ts'
import { planInboxMessage } from './plan.ts'

const SUBJECT_INSTITUTION = 'urn:ard:institution:a3004ff924ece1a2'
const OTHER = 'urn:ard:institution:b71c0e4d9a25f338'
const LIVESTREAM = 'urn:ard:permanent-livestream:49267f7d67be180d'
const PUBLISHER = 'urn:ard:publisher:75dbb3dace15f610'
const INBOX = `inbox.${SUBJECT_INSTITUTION}`
const AT = '2026-10-08T12:00:00.000Z'

const OWNERS = { [LIVESTREAM]: { publisherId: PUBLISHER, institutionId: SUBJECT_INSTITUTION } }

const track = {
	event: 'de.ard.eventhub.v1.radio.track.playing',
	type: 'music',
	start: '2026-10-08T12:00:00+02:00',
	length: 180,
	title: 'Song',
	playlistItemId: 'item-1',
	services: [{ id: LIVESTREAM, publisherId: PUBLISHER, institutionId: SUBJECT_INSTITUTION }],
	creator: 'example@swr.de',
}

/**
 * Plan one JSON payload while the test feed is served.
 * @param body - JSON value
 * @param subject - Inbox subject
 * @returns The plan
 */
const plan = (body: unknown, subject = INBOX): ValidationPlan => {
	const restore = serveTestFeed(OWNERS)
	try {
		return planInboxMessage({ subject, bytes: new TextEncoder().encode(JSON.stringify(body)), at: AT })
	} finally {
		restore()
	}
}

/**
 * Narrow to an accepted plan.
 * @param result - Plan
 * @returns The plan as an accept
 */
const accepted = (result: ValidationPlan): ValidationAccept => {
	if (result.action !== 'ack') throw new Error(`expected ack, got term: ${result.message}`)
	return result
}

/**
 * Narrow to a rejected plan.
 * @param result - Plan
 * @returns The plan as a reject
 */
const rejected = (result: ValidationPlan): ValidationReject => {
	if (result.action !== 'term') throw new Error('expected term, got ack')
	return result
}

test('a valid music now-playing event is retained and fanned out without an explicit plugin', () => {
	const result = accepted(plan(track))
	assertEquals(
		result.radio.map((item) => item.topic),
		[`radio/${LIVESTREAM}/track/playing`]
	)
	assertEquals(
		result.plugins.map((item) => item.subject),
		[`plugin.dts.${LIVESTREAM}.track.playing`, `plugin.radioplayer.${LIVESTREAM}.track.playing`]
	)
})

test('the delivered event keeps the creator and carries the delivery time as created', () => {
	const result = accepted(plan({ ...track, created: '2020-01-01T00:00:00.000Z' }))
	for (const item of [...result.radio, ...result.plugins]) {
		const body = item.body as { creator: string; created: string }
		assertEquals(body.creator, 'example@swr.de')
		assertEquals(body.created, AT)
	}
})

test('an event without a creator is a schema rejection', () => {
	const result = rejected(plan({ ...track, creator: undefined }))
	assertEquals(result.cause, 'schema')
	const body = result.feedback?.body as { issues: { path: string[] }[] } | undefined
	assertEquals(body?.issues[0]?.path, ['creator'])
})

test('a duplicated service is retained and fanned out once', () => {
	const result = accepted(plan({ ...track, services: [...track.services, ...track.services] }))
	assertEquals(result.radio.length, 1)
	assertEquals(result.plugins.length, 2)
})

test('a schema failure is feedback the rejections board can read', () => {
	const result = rejected(plan({ ...track, title: undefined }))
	assertEquals(result.cause, 'schema')
	assertEquals(result.feedback?.topic, `feedback/${SUBJECT_INSTITUTION}`)
	const row = parseRejection(JSON.stringify(result.feedback?.body), `feedback.${SUBJECT_INSTITUTION}`, AT)
	assertEquals(row.cause, 'schema')
	assertEquals(row.playlistItemId, 'item-1')
	assertEquals(row.institutionId, SUBJECT_INSTITUTION)
	assertEquals(row.message.length > 0, true)
	assertEquals(row.event, result.payload)
})

test('feedback leaves out fields the payload did not carry', () => {
	const result = rejected(plan({ ...track, title: undefined, playlistItemId: undefined }))
	const body = result.feedback?.body as Record<string, unknown>
	assertEquals('playlistItemId' in body, false)
	assertEquals('disagreed' in body, false)
	assertEquals('deprecated' in body, false)
})

test('a payload that is not JSON is a json rejection', () => {
	const result = rejected(planInboxMessage({ subject: INBOX, bytes: new TextEncoder().encode('{nope'), at: AT }))
	assertEquals(result.cause, 'json')
	assertEquals(result.message, 'payload is not JSON')
})

test('a rejection carries the full decoded event for the log and the feedback', () => {
	const body = { ...track, title: undefined, extra: { nested: [1, 2] } }
	const result = rejected(plan(body))
	assertEquals(result.payload, JSON.parse(JSON.stringify(body)))
	const feedback = result.feedback?.body as Record<string, unknown> | undefined
	assertEquals(feedback?.event, result.payload)
	assertEquals(feedback !== undefined && 'payload' in feedback, false)
})

test('a non-JSON or non-UTF-8 rejection carries the payload text', () => {
	const notJson = rejected(planInboxMessage({ subject: INBOX, bytes: new TextEncoder().encode('{nope'), at: AT }))
	assertEquals(notJson.payload, '{nope')
	const notUtf8 = rejected(planInboxMessage({ subject: INBOX, bytes: new Uint8Array([0x7b, 0xff, 0x7d]), at: AT }))
	assertEquals(notUtf8.cause, 'json')
	assertEquals(notUtf8.payload, '{\uFFFD}')
})

test('an oversized rejected payload is logged as a prefix with its size', () => {
	const bytes = new TextEncoder().encode(`"${'x'.repeat(70 * 1024)}"`)
	const result = rejected(planInboxMessage({ subject: 'inbox.not-an-institution', bytes, at: AT }))
	const payload = result.payload as { truncated: boolean; bytes: number; head: string }
	assertEquals(payload.truncated, true)
	assertEquals(payload.bytes, bytes.byteLength)
	assertEquals(payload.head.length, 64 * 1024)
})

test('a mismatched institution is rejected even when the subject itself is well formed', () => {
	const result = rejected(
		plan({
			...track,
			services: [{ id: LIVESTREAM, publisherId: PUBLISHER, institutionId: OTHER }],
		})
	)
	assertEquals(result.cause, 'ownership')
	const body = result.feedback?.body as { disagreed?: string[]; message?: string; livestreamId?: string }
	assertEquals(body.disagreed, ['subject', 'payload', 'feed'])
	assertEquals(body.message?.includes('inbox subject'), true)
	assertEquals(body.livestreamId, LIVESTREAM)
})

test('an unknown livestream is an ownership rejection', () => {
	const missing = 'urn:ard:permanent-livestream:0000000000000000'
	const result = rejected(
		plan({
			...track,
			services: [{ id: missing, publisherId: PUBLISHER, institutionId: SUBJECT_INSTITUTION }],
		})
	)
	assertEquals(result.cause, 'ownership')
	const body = result.feedback?.body as { disagreed?: string[] }
	assertEquals(body.disagreed, ['feed'])
})

test('a subject without an institution URN is termed with no feedback', () => {
	const result = rejected(plan(track, 'inbox.not-an-institution'))
	assertEquals(result.cause, 'ownership')
	assertEquals(result.feedback, null)
	assertEquals(result.payload, track)
})

test('a valid event without a served feed throws so the loop naks instead of rejecting', () => {
	assertThrows(
		() => planInboxMessage({ subject: INBOX, bytes: new TextEncoder().encode(JSON.stringify(track)), at: AT }),
		Error,
		'ard feed is not loaded'
	)
})

test('track.next is retained and does not fan out when no plugin is set', () => {
	const result = accepted(plan({ ...track, event: 'de.ard.eventhub.v1.radio.track.next' }))
	assertEquals(
		result.radio.map((item) => item.topic),
		[`radio/${LIVESTREAM}/track/next`]
	)
	assertEquals(result.plugins, [])
})
