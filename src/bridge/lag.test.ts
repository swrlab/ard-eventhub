import type { BridgeLag } from './lag.ts'
import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { getBridgeLag, recordRelay, resetBridgeLag } from './lag.ts'

test('bridge lag grows from start until a relay, then from the last publish', () => {
	resetBridgeLag(1_000)
	const before: BridgeLag = getBridgeLag(1_400)
	assertEquals(before, {
		startedAtMs: 1_000,
		lastRelayedAtMs: null,
		lastRelayLatencyMs: null,
		lagMs: 400,
	})

	recordRelay(1_500, 1_525)
	assertEquals(getBridgeLag(1_800), {
		startedAtMs: 1_000,
		lastRelayedAtMs: 1_525,
		lastRelayLatencyMs: 25,
		lagMs: 275,
	})
})
