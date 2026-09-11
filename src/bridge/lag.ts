/** Snapshot of bridge freshness. `lagMs` grows when nothing is relayed (downtime visible). */
export type BridgeLag = {
	startedAtMs: number
	lastRelayedAtMs: number | null
	lastRelayLatencyMs: number | null
	lagMs: number
}

const state = {
	startedAtMs: 0,
	lastRelayedAtMs: null as number | null,
	lastRelayLatencyMs: null as number | null,
}

/**
 * Mark process start so lag grows even before the first relay.
 * @param nowMs - Clock
 */
export const resetBridgeLag = (nowMs = Date.now()): void => {
	state.startedAtMs = nowMs
	state.lastRelayedAtMs = null
	state.lastRelayLatencyMs = null
}

/**
 * Record one successful GCP→CN publish.
 * @param receivedAtMs - When the MQTT message arrived
 * @param publishedAtMs - When the NATS publish completed
 */
export const recordRelay = (receivedAtMs: number, publishedAtMs: number): void => {
	state.lastRelayedAtMs = publishedAtMs
	state.lastRelayLatencyMs = Math.max(0, publishedAtMs - receivedAtMs)
}

/**
 * Current lag: time since last relay, or since start if none yet.
 * @param nowMs - Clock
 * @returns Lag snapshot
 */
export const getBridgeLag = (nowMs = Date.now()): BridgeLag => {
	const startedAtMs = state.startedAtMs || nowMs
	const lastRelayedAtMs = state.lastRelayedAtMs
	return {
		startedAtMs,
		lastRelayedAtMs,
		lastRelayLatencyMs: state.lastRelayLatencyMs,
		lagMs: nowMs - (lastRelayedAtMs ?? startedAtMs),
	}
}

resetBridgeLag()
