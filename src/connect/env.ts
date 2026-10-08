import { getEnv } from '../utils/env.ts'
import { mqttUrlForNats, parseUserinfoUrl } from '../utils/url-auth.ts'

export const DEFAULT_NATS_URL = 'nats://127.0.0.1:4222'

const natsEndpoint = parseUserinfoUrl(getEnv<string>('NATS_URL', { defaultValue: DEFAULT_NATS_URL }))

/**
 * NATS server URL with userinfo removed. Safe to log and to send to the operator UI.
 * Set credentials on `NATS_URL` as `nats://user:password@host:4222`.
 */
export const natsUrl = natsEndpoint.url

/**
 * Username from `NATS_URL` userinfo. Empty when the URL has none.
 */
export const natsUser = natsEndpoint.user

/**
 * Password from `NATS_URL` userinfo. Empty when the URL has none.
 */
export const natsPassword = natsEndpoint.password

/**
 * MQTT gateway the sidecar uses for RETAIN. NATS core has no retain flag.
 * Default is the `NATS_URL` host on port 1883. Credentials stay on `NATS_URL`.
 */
export const natsMqttUrl = getEnv<string>('NATS_MQTT_URL', { defaultValue: mqttUrlForNats(natsUrl) })

/**
 * ARD core livestream feed. Empty skips the pull and keeps the KV or disk copy.
 * `just env` injects it from sops. The UI still starts when it is unset.
 */
export const ardFeedUrl = getEnv<string>('ARD_FEED_URL', { defaultValue: '' })
