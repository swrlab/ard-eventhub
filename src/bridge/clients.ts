import type { IClientOptions } from 'mqtt'
import { mqttTlsConnectOptions } from '../utils/mqtt/tls-ca.ts'

/** Fixed MQTT client id so a second instance is kicked off the GCP broker. */
export const BRIDGE_GCP_CLIENT_ID = 'eventhub-bridge'

/** Distinct id on the CN gateway so the two hops do not share a session. */
export const BRIDGE_CN_CLIENT_ID = 'eventhub-bridge-cn'

/** GCP subscription. No shared subscriptions — a second client would double every event. */
export const GCP_INBOX_FILTER = 'inbox/#'

const MQTT_V311 = 4 as const
const CONNECT_TIMEOUT_MS = 5_000
const RECONNECT_PERIOD_MS = 1_000
const QOS_AT_LEAST_ONCE = 1 as const

/** mqtt.js subscribe options for the GCP inbox. */
export const gcpInboxSubscribe = { qos: QOS_AT_LEAST_ONCE } as const

/** mqtt.js publish options for the CN inbox (same as a migrated publisher). */
export const cnInboxPublish = { qos: QOS_AT_LEAST_ONCE, retain: false } as const

/**
 * Shared mqtt.js reconnect settings.
 * @param clientId - MQTT client id
 * @param tlsCa - Extra CA PEM or path
 * @returns Base connect options
 */
const mqttReconnectOptions = (clientId: string, tlsCa: string): IClientOptions => ({
	clientId,
	protocolVersion: MQTT_V311,
	connectTimeout: CONNECT_TIMEOUT_MS,
	reconnectPeriod: RECONNECT_PERIOD_MS,
	...mqttTlsConnectOptions(tlsCa),
})

/**
 * mqtt.js connect options for the GCP hop. Reconnect stays on.
 * @param tlsCa - `MQTT_TLS_CA` value
 * @returns Options to pass to `mqtt.connect`
 */
export const gcpMqttConnectOptions = (tlsCa: string): IClientOptions =>
	mqttReconnectOptions(BRIDGE_GCP_CLIENT_ID, tlsCa)

/**
 * mqtt.js connect options for the CN gateway as `svc-bridge`.
 * @param tlsCa - `CN_MQTT_TLS_CA` value
 * @param username - CN MQTT user
 * @param password - CN MQTT password
 * @returns Options to pass to `mqtt.connect`
 */
export const cnMqttConnectOptions = (tlsCa: string, username: string, password: string): IClientOptions => ({
	...mqttReconnectOptions(BRIDGE_CN_CLIENT_ID, tlsCa),
	username,
	password,
})
