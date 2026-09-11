import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { isInboxTopic, toPayloadBytes } from './topic.ts'

test('isInboxTopic accepts inbox and inbox/… and ignores other trees', () => {
	assertEquals(isInboxTopic('inbox/urn:ard:institution:a3004ff924ece1a2'), true)
	assertEquals(isInboxTopic('inbox'), true)
	assertEquals(isInboxTopic('radio/urn:ard:permanent-livestream:x/track.playing'), false)
	assertEquals(isInboxTopic('inboxextra/x'), false)
})

test('toPayloadBytes does not JSON-parse or re-encode', () => {
	const raw = new TextEncoder().encode('{"not":"rewritten"}\n\x00trailing')
	const copy = toPayloadBytes(raw)
	assertEquals(copy, raw)
	assertEquals(toPayloadBytes('plain'), new TextEncoder().encode('plain'))
})
