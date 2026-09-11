/**
 * Whether a GCP MQTT topic is an inbox the bridge should republish unchanged.
 * @param topic - MQTT topic from the GCP `inbox/#` subscription
 * @returns True for `inbox` and `inbox/…`
 */
export const isInboxTopic = (topic: string): boolean => topic === 'inbox' || topic.startsWith('inbox/')

/**
 * Copy MQTT payload bytes without parsing or re-encoding JSON.
 * @param payload - mqtt.js bytes or a raw string
 * @returns The same bytes the CN publish should send
 */
export const toPayloadBytes = (payload: Uint8Array | string): Uint8Array => {
	if (typeof payload === 'string') {
		return new TextEncoder().encode(payload)
	}
	return payload instanceof Uint8Array ? payload : new Uint8Array(payload)
}
