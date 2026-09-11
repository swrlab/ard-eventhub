import { recordRelay } from './lag.ts'
import { isInboxTopic, toPayloadBytes } from './topic.ts'

/** How a relayed MQTT message was handled. */
export type RelayResult = 'relayed' | 'skipped'

/** CN MQTT publish used by the bridge. Injected so tests can stub. */
export type BridgePublish = (topic: string, payload: Uint8Array) => void | Promise<void>

/**
 * Republish one GCP MQTT inbox message onto the same CN MQTT topic.
 * No validation, no JSON parse, no institution resolution, no slash/dot rewrite.
 * @param topic - MQTT topic
 * @param payload - Raw MQTT payload
 * @param publish - CN MQTT publish (already authenticated as `svc-bridge`)
 * @param receivedAtMs - Arrival clock for the lag metric
 * @returns `relayed`, or `skipped` when the topic is not under `inbox`
 */
export const relayInbox = async (
	topic: string,
	payload: Uint8Array | string,
	publish: BridgePublish,
	receivedAtMs = Date.now()
): Promise<RelayResult> => {
	if (!isInboxTopic(topic)) {
		return 'skipped'
	}
	const bytes = toPayloadBytes(payload)
	await publish(topic, bytes)
	recordRelay(receivedAtMs, Date.now())
	return 'relayed'
}
