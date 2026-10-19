import type { NatsConnection } from '@nats-io/transport-node'
import type { MqttClient } from 'mqtt'
import type { ValidationPublisher } from '#types'
import { hostname } from 'node:os'
import process from 'node:process'
import { jetstream } from '@nats-io/jetstream'
import mqtt from 'mqtt'
import { natsMqttUrl, natsPassword, natsUser } from '../env.ts'

const MQTT_V311 = 4 as const
const CONNECT_TIMEOUT_MS = 5_000

/**
 * MQTT client id for this pod. Two pods must not share one, or the broker evicts them in a loop.
 * @param instance - Distinguishes clients inside one process (tests)
 * @returns `svc-eventhub-connect-{pod}-{pid}-{instance}`
 */
export const validationClientId = (instance: number): string => {
	const pod = (process.env.POD_NAME?.trim() || hostname()).replace(/[^A-Za-z0-9_-]/g, '-')
	return `svc-eventhub-connect-${pod}-${process.pid}-${instance}`
}

/**
 * MQTT connection as `svc-eventhub-connect`, for retained publishes only.
 * @param clientId - Unique per pod
 * @returns Connected mqtt.js client
 */
export const connectValidationMqtt = (clientId: string): Promise<MqttClient> =>
	mqtt.connectAsync(natsMqttUrl, {
		protocolVersion: MQTT_V311,
		clientId,
		username: natsUser,
		password: natsPassword,
		connectTimeout: CONNECT_TIMEOUT_MS,
	})

/**
 * Retained MQTT publishes plus JetStream publishes for plugin subjects.
 * @param nc - NATS connection that also pulls the inbox
 * @param client - MQTT connection with a pod-unique client id
 * @returns Publisher bound to those connections
 */
export const createValidationPublisher = (nc: NatsConnection, client: MqttClient): ValidationPublisher => {
	const js = jetstream(nc)
	return {
		publishRetained: async (topic, body) => {
			await client.publishAsync(topic, JSON.stringify(body), { qos: 1, retain: true })
		},
		publishPlugin: async (subject, body) => {
			await js.publish(subject, JSON.stringify(body))
		},
	}
}
