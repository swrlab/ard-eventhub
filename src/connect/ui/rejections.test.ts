import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { filterRejections, mergeRejections, parseRejection } from './rejections.ts'

test('a feedback payload keeps the full zod issues and the institution from the subject', () => {
	const row = parseRejection(
		JSON.stringify({
			issues: [{ path: ['title'], message: 'required' }],
			cause: 'schema',
			disagreed: ['subject', 'feed'],
			playlistItemId: 'swr3-1',
			deprecated: ['services.externalId'],
		}),
		'feedback.urn:ard:institution:a3004ff924ece1a2',
		'2026-10-08T10:00:00.000Z'
	)
	assertEquals(row.institutionId, 'urn:ard:institution:a3004ff924ece1a2')
	assertEquals(row.message, '[{"path":["title"],"message":"required"}]')
	assertEquals(row.cause, 'schema')
	assertEquals(row.disagreed, ['subject', 'feed'])
	assertEquals(row.deprecated, ['services.externalId'])
	assertEquals(row.playlistItemId, 'swr3-1')
})

test('rejections merge newest first and filter to one institution', () => {
	const older = parseRejection('{"message":"old"}', 'feedback.urn:ard:institution:one', '2026-10-08T08:00:00.000Z')
	const newer = parseRejection('{"message":"new"}', 'feedback.urn:ard:institution:two', '2026-10-08T10:00:00.000Z')
	const merged = mergeRejections([older, newer, newer])
	assertEquals(
		merged.map((row) => row.message),
		['new', 'old']
	)
	assertEquals(
		filterRejections(merged, 'urn:ard:institution:one').map((row) => row.message),
		['old']
	)
	assertEquals(filterRejections(merged, null).length, 2)
})
