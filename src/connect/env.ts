import { logger } from '@frytg/logger'
import { getEnv } from '../utils/env.ts'
import { mqttUrlForNats, parseUserinfoUrl, type EndpointAuth } from '../utils/url-auth.ts'

export const DEFAULT_NATS_URL = 'nats://127.0.0.1:4222'

/**
 * NATS address plus the login from `NATS_USER` and `NATS_PASSWORD`.
 * Userinfo on the URL is dropped, so a password in `NATS_URL` is not used and is not logged.
 * @param rawUrl - `NATS_URL`
 * @param user - `NATS_USER`
 * @param password - `NATS_PASSWORD`
 * @returns Host URL and the env credentials
 */
export const resolveNatsAuth = (rawUrl: string, user: string, password: string): EndpointAuth => {
	const parsed = parseUserinfoUrl(rawUrl)
	return {
		url: parsed.url,
		user: user.trim(),
		password: password.trim(),
	}
}

const rawNatsUrl = getEnv<string>('NATS_URL', { defaultValue: DEFAULT_NATS_URL })
const embedded = parseUserinfoUrl(rawNatsUrl)
if (embedded.user || embedded.password) {
	logger.warning({
		message: 'NATS_URL userinfo is ignored; set NATS_USER and NATS_PASSWORD',
		source: 'connect.env',
	})
}

const natsAuth = resolveNatsAuth(
	rawNatsUrl,
	getEnv<string>('NATS_USER', { defaultValue: '' }),
	getEnv<string>('NATS_PASSWORD', { defaultValue: '' })
)

/**
 * NATS server URL with any userinfo removed. Safe to log and to send to the operator UI.
 * Credentials are `NATS_USER` and `NATS_PASSWORD`, not the URL.
 */
export const natsUrl = natsAuth.url

/**
 * Username from `NATS_USER`. Empty when unset.
 */
export const natsUser = natsAuth.user

/**
 * Password from `NATS_PASSWORD`. Empty when unset.
 */
export const natsPassword = natsAuth.password

/**
 * MQTT gateway the validation loop uses for RETAIN. NATS core has no retain flag.
 * Default is the `NATS_URL` host on port 1883. Authentication uses `NATS_USER` and `NATS_PASSWORD`.
 */
export const natsMqttUrl = getEnv<string>('NATS_MQTT_URL', { defaultValue: mqttUrlForNats(natsUrl) })

/**
 * ARD core livestream feed, downloaded on a cold KV and by `/api/update-feed`.
 * Empty skips the download, so the process serves whatever another process wrote to KV.
 * `just env` injects it from sops. The UI still starts when it is unset.
 */
export const ardFeedUrl = getEnv<string>('ARD_FEED_URL', { defaultValue: '' })
