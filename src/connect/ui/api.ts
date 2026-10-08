import type { ClusterReport, ConnectionsReport, LiveConnection, MetaReport } from './types.ts'
import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { natsUrl, natsUser } from '../env.ts'
import { sampleMonitor } from './cluster.ts'
import { natsMonitorUrl, usersConfPath } from './env.ts'
import { errorMessage } from './json.ts'
import { foldOnAir } from './on-air.ts'
import {
	DEFAULT_TAIL_FILTER,
	STATS_POLL_MS,
	TAIL_CAP_MS,
	TAIL_IDLE_MS,
	TAIL_MAX_CONCURRENT,
	TAIL_MAX_PER_SECOND,
} from './policy.ts'
import { filterRejections, mergeRejections, parseRejection } from './rejections.ts'
import { readRetained } from './retained.ts'
import { currentConnection, rejectionLog } from './session.ts'
import { buildUserRows, parseUsersConf } from './users-conf.ts'

export const api = new Hono()

let monitorCache: { at: number; cluster: ClusterReport; connections: LiveConnection[] } | null = null

/**
 * Static description of this process. No secrets.
 * @returns Poll interval, tail limits, and where this UI is pointed
 */
const meta = (): MetaReport => ({
	pollMs: STATS_POLL_MS,
	tailIdleMs: TAIL_IDLE_MS,
	tailCapMs: TAIL_CAP_MS,
	tailMax: TAIL_MAX_CONCURRENT,
	tailPerSecond: TAIL_MAX_PER_SECOND,
	defaultFilter: DEFAULT_TAIL_FILTER,
	monitor: natsMonitorUrl,
	natsUrl,
	user: natsUser,
})

/**
 * Parse a retained payload, or null when it is not JSON.
 * @param text - Payload text
 * @returns Parsed value, or null
 */
const parseJson = (text: string): unknown => {
	try {
		return JSON.parse(text) as unknown
	} catch {
		return null
	}
}

/**
 * One monitor scrape, shared by the cluster and connections boards.
 * @returns Cluster report and the live sockets from that scrape
 */
const loadMonitor = async (): Promise<{ cluster: ClusterReport; connections: LiveConnection[] }> => {
	const now = Date.now()
	if (monitorCache && now - monitorCache.at < 5_000) return monitorCache
	const sampled = await sampleMonitor(natsMonitorUrl)
	monitorCache = { at: now, cluster: sampled.cluster, connections: sampled.connections }
	return monitorCache
}

api.get('/meta', (c) => c.json(meta()))

api.get('/cluster', async (c) => c.json((await loadMonitor()).cluster))

api.get('/connections', async (c) => {
	const sampled = await loadMonitor()
	let note: string | null = null
	let configured: ReturnType<typeof parseUsersConf> = []
	try {
		configured = parseUsersConf(readFileSync(usersConfPath, 'utf8'))
	} catch (error) {
		note = errorMessage(error)
	}
	const body: ConnectionsReport = {
		at: sampled.cluster.at,
		error: sampled.cluster.error,
		note,
		users: buildUserRows(configured, sampled.connections),
		connections: sampled.connections,
	}
	return c.json(body)
})

api.get('/on-air', async (c) => {
	const at = new Date().toISOString()
	const nc = currentConnection()
	if (!nc) {
		return c.json({ at, error: 'nats is unavailable', note: null, truncated: false, stations: [] })
	}
	const retained = await readRetained(nc, 'radio.>')
	const stations = foldOnAir(
		retained.messages.map((message) => ({
			subject: message.subject,
			at: message.at,
			payload: parseJson(message.text),
		}))
	)
	const note = stations.length === 0 && !retained.error ? 'no retained radio subject on this cluster' : null
	return c.json({ at, error: retained.error, note, truncated: retained.truncated, stations })
})

api.get('/rejections', async (c) => {
	const at = new Date().toISOString()
	const institution = c.req.query('institution')?.trim() || null
	let error: string | null = null
	let retainedRows: ReturnType<typeof parseRejection>[] = []
	const nc = currentConnection()
	if (!nc) {
		error = 'nats is unavailable'
	} else {
		const retained = await readRetained(nc, 'feedback.>')
		error = retained.error
		retainedRows = retained.messages.map((message) => parseRejection(message.text, message.subject, message.at))
	}
	const rows = filterRejections(mergeRejections([...rejectionLog.list(), ...retainedRows]), institution)
	const failure = error ?? rejectionLog.liveError()
	const note = rows.length === 0 && !failure ? 'no rejection on feedback.>' : null
	return c.json({ at, error: failure, note, institution, rejections: rows })
})

api.all('*', (c) => c.json({ error: 'not found' }, 404))
