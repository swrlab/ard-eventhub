import { LOCAL_NATS_PASSWORD, LOCAL_NATS_USERS } from '../connect/dev-users.ts'
import { getEnv } from '../utils/env.ts'

const DEFAULT_MQTT_URL = 'mqtt://127.0.0.1:1883'

/**
 * GCP / NanoMQ hop the bridge subscribes to. Same broker ingest dual-writes.
 * Do not import `#env` — that module requires ingest GCP vars.
 */
export const gcpMqttUrl = getEnv<string>('MQTT_BROKER_URL', { defaultValue: DEFAULT_MQTT_URL })

/**
 * Optional hop CA for mqtts://. PEM text or a path. Unset for local `mqtt://`.
 */
export const mqttTlsCa = getEnv<string>('MQTT_TLS_CA', { defaultValue: '' })

/**
 * CN MQTT gateway (NATS MQTT). Same listener migrated publishers use.
 */
export const cnMqttUrl = getEnv<string>('CN_MQTT_URL', { defaultValue: DEFAULT_MQTT_URL })

/**
 * Optional CN gateway CA for mqtts://. Unset for local `mqtt://`.
 */
export const cnMqttTlsCa = getEnv<string>('CN_MQTT_TLS_CA', { defaultValue: '' })

/**
 * CN MQTT user. Defaults to local `svc-bridge` (publish `inbox.>`, MQTT only).
 */
export const cnMqttUser = getEnv<string>('NATS_USER', { defaultValue: LOCAL_NATS_USERS.svcBridge })

/**
 * CN MQTT password. Defaults to the well-known local password. Override via sops.
 */
export const cnMqttPassword = getEnv<string>('NATS_PASSWORD', { defaultValue: LOCAL_NATS_PASSWORD })
