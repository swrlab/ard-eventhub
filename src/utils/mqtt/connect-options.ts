import type { IClientOptions } from 'mqtt'

const MQTT_V311 = 4 as const
const CONNECT_TIMEOUT_MS = 5_000

/**
 * mqtt.js connect options for ingest publishing as `svc-ingest`.
 * A unique client id per process so replicas do not steal each other's session.
 * @param clientId - Per-process MQTT client id
 * @param username - MQTT username (`svc-ingest` locally)
 * @param password - MQTT password
 * @returns Options to pass to `mqtt.connect`
 */
export const ingestMqttConnectOptions = (clientId: string, username: string, password: string): IClientOptions => ({
	clientId,
	protocolVersion: MQTT_V311,
	connectTimeout: CONNECT_TIMEOUT_MS,
	username,
	password,
})
