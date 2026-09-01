import type { MqttClient } from 'mqtt'
import { logger } from '@frytg/logger'
import { getMqttClient } from './_client.ts'

const source = 'utils.mqtt.publishInbox'
const QOS_AT_LEAST_ONCE = 1

/**
 * Inbox topic for an institution URN.
 * @param institutionId - `urn:ard:institution:…`
 * @returns MQTT topic `inbox/{institutionId}`
 */
export const inboxTopic = (institutionId: string): string => `inbox/${institutionId}`

/**
 * Publish JSON to a topic with QoS 1 and retain off.
 * @param client - Connected mqtt.js client
 * @param topic - MQTT topic
 * @param payload - JSON-serializable body
 * @returns Resolves when the broker accepts the publish
 */
const publishJson = (client: MqttClient, topic: string, payload: unknown): Promise<void> =>
	new Promise((resolve, reject) => {
		client.publish(topic, JSON.stringify(payload), { qos: QOS_AT_LEAST_ONCE, retain: false }, (error?: Error) => {
			if (error) reject(error)
			else resolve()
		})
	})

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
			const client = await getMqttClient()
			await publishJson(client, inboxTopic(institutionId), payload)
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
