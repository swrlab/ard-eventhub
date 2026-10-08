import { join } from 'node:path'
import { getEnv } from '../../utils/env.ts'
import { natsUrl } from '../env.ts'

/** Browser tail listener. Same host as `NATS_URL`, port 8080, unless `NATS_WS_URL` is set. */
const NATS_WS_PORT = 8080

/**
 * Default WebSocket URL for the operator tail.
 * `tls://` becomes `wss://`. Anything else becomes `ws://`.
 * @param raw - NATS server URL
 * @returns `ws://` or `wss://` URL with an explicit port
 */
const defaultWsUrl = (raw: string): string => {
	try {
		const url = new URL(raw)
		const scheme = url.protocol === 'tls:' ? 'wss:' : 'ws:'
		return `${scheme}//${url.hostname}:${NATS_WS_PORT}`
	} catch {
		return `ws://127.0.0.1:${NATS_WS_PORT}`
	}
}

/** HTTP port for the operator UI, served by the connect process. */
export const uiPort = getEnv<number>('UI_PORT', { defaultValue: 4173, type: 'number' })

/** Bind address. Production should pin this to the CN-facing interface. */
export const uiHost = getEnv<string>('UI_HOST', { defaultValue: '0.0.0.0' })

/**
 * NATS monitoring origin. The dev cluster is `http://leno0:8222`.
 * Local `just nats-up` is `http://127.0.0.1:8222`.
 */
export const natsMonitorUrl = getEnv<string>('NATS_MONITOR_URL', { defaultValue: 'http://127.0.0.1:8222' })

/**
 * NATS WebSocket origin for the browser tail.
 * The page connects here as `sub-ui` with no password.
 */
export const natsWsUrl = getEnv<string>('NATS_WS_URL', { defaultValue: defaultWsUrl(natsUrl) })

/** Path to the NATS users file. The board shows usernames and ACLs, never the hash. */
const defaultUsersConf = join(import.meta.dir, '../../../infra/kubernetes/components/users/nats-users.conf')

/** Override when the broker's user file is not the repo copy. */
export const usersConfPath = getEnv<string>('NATS_USERS_CONF', { defaultValue: defaultUsersConf })

/**
 * Comma-separated source CIDRs. Empty allows every peer, which is the local default.
 * Set this in production. The check uses the socket address, not `X-Forwarded-For`.
 */
export const uiAllowCidr = getEnv<string>('UI_ALLOW_CIDR', { defaultValue: '' })

/** `true` loads the UI from the Vite dev server instead of `static/dist`. */
export const useHmr = getEnv<string>('USE_HMR', { defaultValue: '' }) === 'true'

/** Repo root. Static files and the Vite manifest live under here. */
export const staticRoot = join(import.meta.dir, '../../..')

/** Vite manifest written by `just ui-build`. */
export const manifestPath = join(staticRoot, 'static/dist/manifest.json')
