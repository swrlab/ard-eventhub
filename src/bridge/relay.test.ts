import type { BridgePublish, RelayResult } from './relay.ts'
import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { getBridgeLag, resetBridgeLag } from './lag.ts'
import { relayInbox } from './relay.ts'

test('relayInbox publishes byte-identical payload on the same MQTT inbox topic', async () => {
	resetBridgeLag(10)
	const payload = new Uint8Array([0, 1, 2, 255, 10])
	const published: Array<{ topic: string; payload: Uint8Array }> = []
	const result: RelayResult = await relayInbox(
		'inbox/urn:ard:institution:a3004ff924ece1a2',
		payload,
		(topic, bytes) => {
			published.push({ topic, payload: bytes })
		},
		20
	)
	assertEquals(result, 'relayed')
	assertEquals(published, [{ topic: 'inbox/urn:ard:institution:a3004ff924ece1a2', payload }])
	assertEquals(published[0]?.payload, payload)
	assertEquals(getBridgeLag(50).lastRelayLatencyMs !== null, true)
})

test('relayInbox skips non-inbox topics', async () => {
	const published: string[] = []
	const publish: BridgePublish = (topic) => {
		published.push(topic)
	}
	assertEquals(await relayInbox('plugin.radioplayer.x.track.playing', 'nope', publish), 'skipped')
	assertEquals(published, [])
})
