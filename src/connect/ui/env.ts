import { join } from 'node:path'
import { getEnv } from '../../utils/env.ts'
import { natsUrl } from '../env.ts'

/** Browser tail listener. Same host as `NATS_URL`, port 9222, unless `NATS_WS_URL` is set. */
const NATS_WS_PORT = 9222

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
 * NATS monitoring origin. Local `just nats-up` is `http://127.0.0.1:8222`.
 */
export const natsMonitorUrl = getEnv<string>('NATS_MONITOR_URL', { defaultValue: 'http://127.0.0.1:8222' })

/**
 * NATS WebSocket origin for the browser tail.
 * The page connects here as `sub-ui` with no password.
 */
export const natsWsUrl = getEnv<string>('NATS_WS_URL', { defaultValue: defaultWsUrl(natsUrl) })

/** Path to the NATS users file. The board shows usernames and ACLs, never the hash. */
const defaultUsersConf = join(import.meta.dir, '../../../infra/kubernetes/services/nats/users/nats-users.conf')

/** Override when the broker's user file is not the repo copy. */
export const usersConfPath = getEnv<string>('NATS_USERS_CONF', { defaultValue: defaultUsersConf })

/**
 * Comma-separated source CIDRs. Empty allows every peer, which is the local default.
 * Set this in production. The check uses the socket address, not `X-Forwarded-For`.
 */
export const uiAllowCidr = getEnv<string>('UI_ALLOW_CIDR', { defaultValue: '' })

/** `true` loads the UI from the Vite dev server instead of `static/dist`. */
export const useHmr = getEnv<string>('USE_HMR', { defaultValue: '' }) === 'true'

/** A zone or stage name that can sit in `eventhub-connect-<zone>-<stage>`. */
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * One configured zone or stage, or empty when the env is missing or not a hostname label.
 * @param raw - `ZONE` or `STAGE`
 * @returns Lowercase name, or `''`
 */
const oneName = (raw: string): string => {
	const name = raw.trim().toLowerCase()
	return NAME.test(name) ? name : ''
}

/**
 * Split a comma-separated list of zone or stage names.
 * Drops blanks, duplicates, and anything that is not a hostname label.
 * @param raw - `AVAILABLE_ZONES` or `AVAILABLE_STAGES`
 * @returns Names in env order
 */
export const parseNameList = (raw: string): string[] => {
	const seen = new Set<string>()
	const names: string[] = []
	for (const part of raw.split(',')) {
		const name = oneName(part)
		if (!name || seen.has(name)) continue
		seen.add(name)
		names.push(name)
	}
	return names
}

/**
 * Names a header dropdown offers. Empty when the list was not configured, so a local
 * process does not show a switcher. The current name stays selected even if the list forgot it.
 * @param available - Parsed `AVAILABLE_*` list
 * @param current - This process's `ZONE` or `STAGE`
 * @returns Options, or an empty list
 */
export const switcherNames = (available: readonly string[], current: string): string[] => {
	if (available.length === 0) return []
	if (current && !available.includes(current)) return [current, ...available]
	return [...available]
}

/** This machine. Empty locally, where the header has no host label to swap. */
export const zone = oneName(getEnv<string>('ZONE', { defaultValue: '' }))

/** This deployment. Empty when `STAGE` is unset. */
export const stage = oneName(getEnv<string>('STAGE', { defaultValue: '' }))

/**
 * Zones the header can switch to. Comma-separated. Empty hides the dropdown.
 * Clusters set `bad,mnz,stg`.
 */
export const availableZones = parseNameList(getEnv<string>('AVAILABLE_ZONES', { defaultValue: '' }))

/**
 * Stages the header can switch to. Comma-separated. Empty hides the dropdown.
 * Clusters set `dev,test,prod`.
 */
export const availableStages = parseNameList(getEnv<string>('AVAILABLE_STAGES', { defaultValue: '' }))

/** Repo root. Static files and the Vite manifest live under here. */
export const staticRoot = join(import.meta.dir, '../../..')

/** Vite manifest written by `just ui-build`. */
export const manifestPath = join(staticRoot, 'static/dist/manifest.json')
