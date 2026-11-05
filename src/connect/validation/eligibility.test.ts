import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { enabledPluginTargets } from './eligibility.ts'

const service = {
	id: 'urn:ard:permanent-livestream:49267f7d67be180d',
	publisherId: 'urn:ard:publisher:75dbb3dace15f610',
	institutionId: 'urn:ard:institution:a3004ff924ece1a2',
}

const playing = {
	event: 'de.ard.eventhub.v1.radio.track.playing' as const,
	type: 'music' as const,
	start: '2026-10-08T12:00:00+02:00',
	length: 180,
	title: 'Song',
	playlistItemId: 'item-1',
	services: [service],
	creator: 'example@swr.de',
	created: '2026-10-08T10:00:01.000Z',
}

test('music track.playing reaches dts and radioplayer with no plugins set', () => {
	assertEquals(enabledPluginTargets(playing), ['dts', 'radioplayer'])
})

test('track.next does not auto-enable plugins', () => {
	assertEquals(enabledPluginTargets({ ...playing, event: 'de.ard.eventhub.v1.radio.track.next' }), [])
})

test('an explicit opt-out stays off and the other target still auto-enables', () => {
	assertEquals(enabledPluginTargets({ ...playing, plugins: [{ type: 'dts', isDeactivated: true }] }), ['radioplayer'])
})

test('a non-music playing event does not auto-enable', () => {
	assertEquals(enabledPluginTargets({ ...playing, type: 'news' }), [])
})

test('control events have no plugin targets', () => {
	assertEquals(
		enabledPluginTargets({
			event: 'de.ard.eventhub.v1.radio.control',
			start: '2026-10-08T12:00:00+02:00',
			name: 'TA',
			state: true,
			services: [service],
			creator: 'example@swr.de',
			created: '2026-10-08T10:00:01.000Z',
		}),
		[]
	)
})
