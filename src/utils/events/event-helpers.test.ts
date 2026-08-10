import type { AuthUser } from '#types'
import type { EventhubV1RadioPostBody } from '../../schemas/events.ts'
import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { DateTime } from '@frytg/dates'
import {
	buildEventMessage,
	ensureDefaultPlugins,
	isEventStartExpired,
	MAX_OFFSET_IN_MINUTES,
	summarizeEventStatuses,
} from './event-helpers.ts'

const user = {
	email: 'lab@swr.de',
	institution: { id: 'urn:ard:institution:test', name: 'SWR' },
} as AuthUser

test('isEventStartExpired rejects starts beyond the allowed offset', () => {
	const now = DateTime.fromISO('2026-08-10T12:00:00+02:00')
	const expired = now.minus({ minutes: MAX_OFFSET_IN_MINUTES + 1 })
	const fresh = now.minus({ minutes: MAX_OFFSET_IN_MINUTES - 1 })

	assertEquals(isEventStartExpired(expired, now), true)
	assertEquals(isEventStartExpired(fresh, now), false)
})

test('buildEventMessage merges body fields and sets creator metadata', () => {
	const start = DateTime.fromISO('2026-08-10T12:00:00+02:00')
	const message = buildEventMessage({
		eventName: 'de.ard.eventhub.v1.radio.track.playing',
		user,
		body: {
			type: 'music',
			title: 'Song',
			services: [],
			playlistItemId: 'item-1',
		},
		start,
	})

	assertEquals(message.name, 'de.ard.eventhub.v1.radio.track.playing')
	assertEquals(message.creator, 'lab@swr.de')
	assertEquals(message.type, 'music')
	assertEquals(message.title, 'Song')
	assertEquals(message.plugins, [])
})

test('ensureDefaultPlugins adds dts and radioplayer for music now-playing', () => {
	const message = {
		name: 'de.ard.eventhub.v1.radio.track.playing',
		plugins: [],
	} as unknown as EventhubV1RadioPostBody

	ensureDefaultPlugins(message, { type: 'music' })
	assertEquals(
		message.plugins.map((plugin) => plugin.type),
		['dts', 'radioplayer']
	)
})

test('ensureDefaultPlugins does not duplicate existing plugins', () => {
	const message = {
		name: 'de.ard.eventhub.v1.radio.track.playing',
		plugins: [{ type: 'dts', isDeactivated: false }],
	} as unknown as EventhubV1RadioPostBody

	ensureDefaultPlugins(message, { type: 'music' })
	assertEquals(
		message.plugins.map((plugin) => plugin.type),
		['dts', 'radioplayer']
	)
})

test('summarizeEventStatuses counts published blocked and failed services', () => {
	const statuses = summarizeEventStatuses([
		{
			type: 'PermanentLivestream',
			externalId: 'a',
			publisherId: '1',
			topic: { id: 't', name: 'n', messageId: 'm1' },
		},
		{ type: 'PermanentLivestream', externalId: 'b', publisherId: '2', blocked: 'yes' },
		{ type: 'PermanentLivestream', externalId: 'c', publisherId: '3', topic: { id: 't', name: 'n' } },
	])

	assertEquals(statuses, { published: 1, blocked: 1, failed: 1 })
})
