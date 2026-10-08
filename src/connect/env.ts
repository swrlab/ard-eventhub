import { getEnv } from '../utils/env.ts'
import { LOCAL_NATS_PASSWORD, LOCAL_NATS_USERS } from './dev-users.ts'

export const DEFAULT_NATS_URL = 'nats://127.0.0.1:4222'

/**
 * NATS client URL for eventhub-connect. Defaults to the local single-node broker.
 */
export const natsUrl = getEnv<string>('NATS_URL', { defaultValue: DEFAULT_NATS_URL })

/**
 * NATS user. Defaults to local `svc-sidecar`. Override in production via sops.
 */
export const natsUser = getEnv<string>('NATS_USER', { defaultValue: LOCAL_NATS_USERS.svcSidecar })

/**
 * NATS password. Defaults to the well-known local password. Override in production via sops.
 */
export const natsPassword = getEnv<string>('NATS_PASSWORD', { defaultValue: LOCAL_NATS_PASSWORD })

/**
 * ARD core livestream feed. Empty skips the pull and keeps the KV or disk copy.
 * `just env` injects it from sops. The UI still starts when it is unset.
 */
export const ardFeedUrl = getEnv<string>('ARD_FEED_URL', { defaultValue: '' })
