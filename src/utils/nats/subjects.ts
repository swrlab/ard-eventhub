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
 * Validated radio subject. `{eventClass}` is the tree token (`track.playing`, `control`, …).
 * @param livestreamId - `urn:ard:permanent-livestream:…`
 * @param eventClass - Event class as it appears in the `radio.` tree
 * @returns `radio.{livestreamId}.{eventClass}`
 */
export const radioSubject = (livestreamId: string, eventClass: string): string => `radio.${livestreamId}.${eventClass}`

/**
 * Internal plugin work-queue subject. Not exposed over MQTT.
 * @param target - Plugin target (`radioplayer`, `dts`, …)
 * @param livestreamId - `urn:ard:permanent-livestream:…`
 * @param eventClass - Event class as it appears in the `radio.` tree
 * @returns `plugin.{target}.{livestreamId}.{eventClass}`
 */
export const pluginSubject = (target: string, livestreamId: string, eventClass: string): string =>
	`plugin.${target}.${livestreamId}.${eventClass}`
