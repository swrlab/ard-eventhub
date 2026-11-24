import type { DTSKeys, RadioplayerApiKeys, Stage } from './schemas/config.ts'
import { getRequiredEnv } from '@frytg/check-required-env/get'
import { getEnv, getEnvBase64, getEnvBoolean, getEnvNumber } from './utils/env.ts'
import { parseMqttBrokerList } from './utils/mqtt/broker-urls.ts'

// NOTE: keys without a default are required and cause an error if missing.

export const stage: Stage = getRequiredEnv('STAGE') as Stage
export const isLocal = getEnvBoolean('IS_LOCAL', false)

export const serviceName = getRequiredEnv('SERVICE_NAME')
export const ardFeedUrl = getRequiredEnv('ARD_FEED_URL')

// export const googleApplicationCredentials = getRequiredEnv('GOOGLE_APPLICATION_CREDENTIALS')
/**
 * GCP Project Id, used for Google Cloud Datastore.
 */
export const projectId = getRequiredEnv('GCP_PROJECT_ID')
/**
 * Google PubSub Service account email (internal)
 */
export const serviceAccountEmail = getRequiredEnv('PUBSUB_SERVICE_ACCOUNT_EMAIL_INTERNAL')
export const firebaseAPIKey = getRequiredEnv('FIREBASE_API_KEY')
export const dtsKeys = getEnvBase64<DTSKeys>('DTS_KEYS')
export const radioplayerAPIKeys = getEnvBase64<RadioplayerApiKeys>('RADIOPLAYER_API_KEYS')

const DEFAULT_HTTP_PORT = 8080
export const port = getEnvNumber('PORT', DEFAULT_HTTP_PORT)

/**
 * Whether ingest publishes plugin jobs to the internal Pub/Sub topic.
 * Only the exact string `true` enables it. Unset, `1`, `TRUE`, and `false` all leave it off.
 * Read at call time so a process restart (or a test) can flip it without re-importing this module.
 * Independent of per-event `plugins[].isDeactivated`.
 * @returns True when plugin job dispatch is on
 */
export const isIngestPublishPluginsEnabled = (): boolean =>
	getEnv<string>('INGEST_PUBLISH_PLUGINS', { defaultValue: '' }) === 'true'

/**
 * CN MQTT gateways for the inbox dual-write.
 * One URL, or a comma-separated failover list (`mqtts://user:password@host:8883,...`).
 * Empty when unset so ingest stays on Pub/Sub. Userinfo is not on `servers`.
 */
export const mqttBrokers = parseMqttBrokerList(getEnv<string>('MQTT_BROKER_URL', { defaultValue: '' }))

/**
 * Optional gateway CA for mqtts://. PEM text, or a path to a PEM file.
 * Unset for local `mqtt://`. The same CA is used for every host in `MQTT_BROKER_URL`.
 */
export const mqttTlsCa = getEnv<string>('MQTT_TLS_CA', { defaultValue: '' })
