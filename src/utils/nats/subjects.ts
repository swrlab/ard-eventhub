/**
 * Eventhub Connect topic tree (RFC §6.2). NATS subjects are the source of truth.
 */

/**
 * Inbox subject for an institution URN.
 * @param institutionId - `urn:ard:institution:…`
 * @returns `inbox.{institutionId}`
 */
export const inboxSubject = (institutionId: string): string => `inbox.${institutionId}`

/**
 * Inbox MQTT topic for an institution URN.
 * @param institutionId - `urn:ard:institution:…`
 * @returns `inbox/{institutionId}`
 */
export const inboxMqttTopic = (institutionId: string): string => `inbox/${institutionId}`

/**
 * Validation-feedback subject for an institution URN.
 * @param institutionId - `urn:ard:institution:…`
 * @returns `feedback.{institutionId}`
 */
export const feedbackSubject = (institutionId: string): string => `feedback.${institutionId}`

/**
 * Validation-feedback MQTT topic. The gateway stores this with RETAIN.
 * @param institutionId - `urn:ard:institution:…`
 * @returns `feedback/{institutionId}`
 */
export const feedbackMqttTopic = (institutionId: string): string => `feedback/${institutionId}`

const INSTITUTION_URN = /^urn:ard:institution:[a-z0-9]+$/

/**
 * Institution URN from an inbox subject. Null when the subject is not `inbox.{institution urn}`.
 * @param subject - NATS subject the message arrived on
 * @returns Institution URN, or null
 */
export const institutionFromInboxSubject = (subject: string): string | null => {
	const prefix = 'inbox.'
	if (!subject.startsWith(prefix)) return null
	const institutionId = subject.slice(prefix.length)
	return INSTITUTION_URN.test(institutionId) ? institutionId : null
}

/**
 * Validated radio subject. `{eventClass}` is the tree token (`track.playing`, `control`, …).
 * @param livestreamId - `urn:ard:permanent-livestream:…`
 * @param eventClass - Event class as it appears in the `radio.` tree
 * @returns `radio.{livestreamId}.{eventClass}`
 */
export const radioSubject = (livestreamId: string, eventClass: string): string => `radio.${livestreamId}.${eventClass}`

/**
 * Validated radio MQTT topic. Dots in the class become slashes.
 * A dot on the wire is encoded as `//` and misses `radio.*.track.playing`.
 * @param livestreamId - `urn:ard:permanent-livestream:…`
 * @param eventClass - Event class as it appears in the `radio.` tree (`track.playing`, `control`)
 * @returns `radio/{livestreamId}/track/playing` for class `track.playing`
 */
export const radioMqttTopic = (livestreamId: string, eventClass: string): string =>
	`radio/${livestreamId}/${eventClass.replaceAll('.', '/')}`

/** Prefix shared by every v1 radio event name. */
const RADIO_EVENT_PREFIX = 'de.ard.eventhub.v1.radio.'

/**
 * Tree token for an event name (`track.playing`, `control`, `data`).
 * @param eventName - `de.ard.eventhub.v1.radio.…`
 * @returns The class segment used in `radio.` and `plugin.` subjects
 */
export const eventClassToken = (eventName: string): string =>
	eventName.startsWith(RADIO_EVENT_PREFIX) ? eventName.slice(RADIO_EVENT_PREFIX.length) : eventName

/**
 * Internal plugin work-queue subject. Not exposed over MQTT.
 * @param target - Plugin target (`radioplayer`, `dts`, …)
 * @param livestreamId - `urn:ard:permanent-livestream:…`
 * @param eventClass - Event class as it appears in the `radio.` tree
 * @returns `plugin.{target}.{livestreamId}.{eventClass}`
 */
export const pluginSubject = (target: string, livestreamId: string, eventClass: string): string =>
	`plugin.${target}.${livestreamId}.${eventClass}`
