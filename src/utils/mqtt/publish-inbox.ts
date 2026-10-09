import type { MqttClient } from 'mqtt'
import { logger } from '@frytg/logger'
import { mqttClient } from './_client.ts'

const source = 'utils.mqtt.publishInbox'
const QOS_AT_LEAST_ONCE = 1

/**
 * Inbox topic for an institution URN.
 * @param institutionId - `urn:ard:institution:…`
 * @returns MQTT topic `inbox/{institutionId}`
 */
export const inboxTopic = (institutionId: string): string => `inbox/${institutionId}`

/**
 * Best-effort publish onto the CN gateway. A missing client is a no-op (Pub/Sub only).
 * Failures are logged and never thrown.
 * @param client - Shared gateway client, or undefined when `MQTT_BROKER_URL` is unset
 * @param institutionId - Authenticated user's institution URN
 * @param payload - Same enriched body published to Pub/Sub
 * @returns Always resolves
 */
export const publishInboxMessage = async (
	client: MqttClient | undefined,
	institutionId: string,
	payload: unknown
): Promise<void> => {
	if (!client) return

	try {
		if (!client.connected) {
			logger.warning({
				message: 'mqtt inbox publish skipped, not connected',
				source,
				data: { institutionId },
			})
			return
		}
		await client.publishAsync(inboxTopic(institutionId), JSON.stringify(payload), {
			qos: QOS_AT_LEAST_ONCE,
			retain: false,
		})
	} catch (error) {
		logger.warning({
			message: 'mqtt inbox publish failed',
			source,
			error,
			data: { institutionId },
		})
	}
}

/**
 * Best-effort MQTT inbox publisher. Failures are logged and never thrown.
 * When `MQTT_BROKER_URL` is unset the publish is a no-op.
 */
export const mqttInbox = {
	/**
	 * Publish an event to `inbox/{institutionId}`.
	 * @param institutionId - Authenticated user's institution URN
	 * @param payload - Same enriched body published to Pub/Sub
	 * @returns Always resolves
	 */
	async publish(institutionId: string, payload: unknown): Promise<void> {
		await publishInboxMessage(mqttClient, institutionId, payload)
	},
}
