import type { DTSKeys, RadioplayerApiKeys, Stage } from './schemas/config.ts'
import { getRequiredEnv } from '@frytg/check-required-env/get'
import { LOCAL_NATS_PASSWORD, LOCAL_NATS_USERS } from './connect/dev-users.ts'
import { getEnv, getEnvBase64, getEnvBoolean, getEnvNumber } from './utils/env.ts'

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
 * CN MQTT gateway for the inbox dual-write.
 * `mqtt://` or `mqtts://`. Empty when unset so ingest stays on Pub/Sub.
 */
export const mqttBrokerUrl = getEnv<string>('MQTT_BROKER_URL', { defaultValue: '' })
/**
 * Optional gateway CA for mqtts://. PEM text, or a path to a PEM file.
 * Unset for local `mqtt://`.
 */
export const mqttTlsCa = getEnv<string>('MQTT_TLS_CA', { defaultValue: '' })
/**
 * MQTT username. Local default is `svc-ingest` (publish `inbox.>`, MQTT only).
 */
export const mqttUsername = getEnv<string>('MQTT_USERNAME', { defaultValue: LOCAL_NATS_USERS.svcIngest })
/**
 * MQTT password. Local default matches `infra/nats/nats-users.conf`. Override via sops.
 */
export const mqttPassword = getEnv<string>('MQTT_PASSWORD', { defaultValue: LOCAL_NATS_PASSWORD })
