import { getEnv } from '../utils/env.ts'

export const DEFAULT_NATS_URL = 'nats://127.0.0.1:4222'

/**
 * NATS client URL for eventhub-connect. Defaults to the local single-node broker.
 */
export const natsUrl = getEnv<string>('NATS_URL', { defaultValue: DEFAULT_NATS_URL })

/**
 * Optional NATS user (later `svc-sidecar`). Empty means anonymous local access.
 */
export const natsUser = getEnv<string>('NATS_USER', { defaultValue: '' })

/**
 * Optional NATS password. Empty means anonymous local access.
 */
export const natsPassword = getEnv<string>('NATS_PASSWORD', { defaultValue: '' })
