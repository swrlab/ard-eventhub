import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { filterRejections, mergeRejections, parseRejection } from './rejections.ts'

const titleError = {
	path: '.body.title',
	message: "should have required property 'title'",
	errorCode: 'required.openapi.validation',
}

test('a feedback payload keeps its errors and created, and the institution from the subject', () => {
	const row = parseRejection(
		JSON.stringify({
			created: '2026-10-08T09:00:00.000Z',
			errors: [titleError, { path: '.body', message: 'no errorCode' }],
			playlistItemId: 'swr3-1',
			event: { playlistItemId: 'swr3-1', services: [] },
		}),
		'feedback.urn:ard:institution:a3004ff924ece1a2',
		'2026-10-08T10:00:00.000Z'
	)
	assertEquals(row.created, '2026-10-08T09:00:00.000Z')
	assertEquals(row.institutionId, 'urn:ard:institution:a3004ff924ece1a2')
	assertEquals(row.errors, [titleError])
	assertEquals(row.playlistItemId, 'swr3-1')
	assertEquals(row.event, { playlistItemId: 'swr3-1', services: [] })
})

test('feedback without an event, or not JSON at all, has no errors and a null event', () => {
	const empty = parseRejection('{}', 'feedback.x', '2026-10-08T08:00:00.000Z')
	const text = parseRejection('nope', 'feedback.x', '2026-10-08T08:00:00.000Z')
	assertEquals(empty.created, '2026-10-08T08:00:00.000Z')
	assertEquals([empty.errors, empty.event], [[], null])
	assertEquals([text.errors, text.event], [[], null])
})

test('rejections merge newest first and filter to one institution', () => {
	const older = parseRejection(
		JSON.stringify({ errors: [titleError], playlistItemId: 'old' }),
		'feedback.urn:ard:institution:one',
		'2026-10-08T08:00:00.000Z'
	)
	const newer = parseRejection(
		JSON.stringify({ errors: [titleError], playlistItemId: 'new' }),
		'feedback.urn:ard:institution:two',
		'2026-10-08T10:00:00.000Z'
	)
	const merged = mergeRejections([older, newer, newer])
	assertEquals(
		merged.map((row) => row.playlistItemId),
		['new', 'old']
	)
	assertEquals(
		filterRejections(merged, 'urn:ard:institution:one').map((row) => row.playlistItemId),
		['old']
	)
	assertEquals(filterRejections(merged, null).length, 2)
})
