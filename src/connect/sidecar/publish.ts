import type { NatsConnection } from '@nats-io/transport-node'
import type { MqttClient } from 'mqtt'
import { hostname } from 'node:os'
import process from 'node:process'
import { jetstream } from '@nats-io/jetstream'
import mqtt from 'mqtt'
import { natsMqttUrl, natsPassword, natsUser } from '../env.ts'

const MQTT_V311 = 4 as const
const CONNECT_TIMEOUT_MS = 5_000

/** How the loop publishes. Tests can substitute an in-memory pair. */
export type SidecarPublisher = {
	/**
	 * MQTT publish with RETAIN. Used for `radio/` and `feedback/`.
	 * @param topic - MQTT topic (`/` separators)
	 * @param body - JSON value
	 * @returns Resolves after the QoS 1 PUBACK
	 */
	publishRetained: (topic: string, body: unknown) => Promise<void>
	/**
	 * NATS-native publish captured by the PLUGINS stream. Not retained.
	 * @param subject - `plugin.{target}.{livestreamId}.{class}`
	 * @param body - Validated event
	 * @returns Resolves after the JetStream pub ack
	 */
	publishPlugin: (subject: string, body: unknown) => Promise<void>
}

/**
 * MQTT client id for this pod. Two pods must not share one, or the broker evicts them in a loop.
 * @param instance - Distinguishes clients inside one process (tests)
 * @returns `svc-sidecar-{pod}-{pid}-{instance}`
 */
export const sidecarClientId = (instance: number): string => {
	const pod = (process.env.POD_NAME?.trim() || hostname()).replace(/[^A-Za-z0-9_-]/g, '-')
	return `svc-sidecar-${pod}-${process.pid}-${instance}`
}

/**
 * MQTT connection as the sidecar user, for retained publishes only.
 * @param clientId - Unique per pod
 * @returns Connected mqtt.js client
 */
export const connectSidecarMqtt = (clientId: string): Promise<MqttClient> =>
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
export const createSidecarPublisher = (nc: NatsConnection, client: MqttClient): SidecarPublisher => {
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
