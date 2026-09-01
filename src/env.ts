import type { DTSKeys, RadioplayerApiKeys, Stage } from './schemas/config.ts'
import { getEnvBase64, getEnvBoolean, getEnvNumber, getEnvString } from './utils/env.ts'

// NOTE: keys without a default are required and cause an error if missing.

export const stage: Stage = getEnvString('STAGE') as Stage
export const isLocal = getEnvBoolean('IS_LOCAL', false)

export const serviceName = getEnvString('SERVICE_NAME')
export const ardFeedUrl = getEnvString('ARD_FEED_URL')

// export const googleApplicationCredentials = getEnvString('GOOGLE_APPLICATION_CREDENTIALS')
/**
 * GCP Project Id, used for Google Cloud Datastore.
 */
export const projectId = getEnvString('GCP_PROJECT_ID')
/**
 * Google PubSub Service account email (internal)
 */
export const serviceAccountEmail = getEnvString('PUBSUB_SERVICE_ACCOUNT_EMAIL_INTERNAL')
export const firebaseAPIKey = getEnvString('FIREBASE_API_KEY')
export const dtsKeys = getEnvBase64<DTSKeys>('DTS_KEYS')
export const radioplayerAPIKeys = getEnvBase64<RadioplayerApiKeys>('RADIOPLAYER_API_KEYS')

const DEFAULT_HTTP_PORT = 8080
export const port = getEnvNumber('PORT', DEFAULT_HTTP_PORT)

/**
 * Datadog tracer enabled (`DD_TRACER_ENABLED === 'true'`).
 * `false` by default.
 */
export const tracerEnabled = getEnvBoolean('DD_TRACER_ENABLED', false)

/**
 * MQTT broker connection string for the inbox dual-write hop.
 * `mqtt://` or `mqtts://`, with optional `user:pass@` in the URL.
 */
export const mqttBrokerUrl = getEnvString('MQTT_BROKER_URL')
