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
 * Best-effort MQTT inbox publisher. Failures are logged and never thrown.
 */
export const mqttInbox = {
	/**
	 * Publish an event to `inbox/{institutionId}`.
	 * @param institutionId - Authenticated user's institution URN
	 * @param payload - Same enriched body published to Pub/Sub
	 * @returns Always resolves
	 */
	async publish(institutionId: string, payload: unknown): Promise<void> {
		try {
			if (!mqttClient.connected) {
				logger.warning({
					message: 'mqtt inbox publish skipped, not connected',
					source,
					data: { institutionId },
				})
				return
			}
			await mqttClient.publishAsync(inboxTopic(institutionId), JSON.stringify(payload), {
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
	},
}
