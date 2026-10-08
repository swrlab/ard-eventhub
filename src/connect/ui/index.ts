import type { NatsConnection } from '@nats-io/transport-node'
import type { ClusterReport, ConnectionsReport, LiveConnection, MetaReport } from './types.ts'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { logger } from '@frytg/logger'
import { natsAccess } from '../../utils/nats/_client.ts'
import { sampleMonitor } from './cluster.ts'
import {
	defaultDistDir,
	natsMonitorUrl,
	uiAllowCidr,
	uiHost,
	uiNatsPassword,
	uiNatsUrl,
	uiNatsUser,
	uiPort,
	usersConfPath,
} from './env.ts'
import { errorMessage } from './json.ts'
import { foldOnAir } from './on-air.ts'
import {
	STATS_POLL_MS,
	TAIL_CAP_MS,
	TAIL_IDLE_MS,
	TAIL_MAX_CONCURRENT,
	TAIL_MAX_PER_SECOND,
	DEFAULT_TAIL_FILTER,
	ipAllowed,
	parseAllowCidrs,
	parseTailFilter,
} from './policy.ts'
import { attachFeedback, createRejectionLog, filterRejections, mergeRejections, parseRejection } from './rejections.ts'
import { readRetained } from './retained.ts'
import { createApp } from './server.ts'
import { createTailHub, type TailOpen } from './tail-hub.ts'
import { buildUserRows, parseUsersConf } from './users-conf.ts'

const source = 'connect.ui'

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
	natsUrl: uiNatsUrl,
	user: uiNatsUser,
})

type TailSocketData = {
	id: number
	filter: string
	ip: string
}

/**
 * Start the operator UI. Stats are HTTP. The tail is the only WebSocket, and it closes itself.
 * @returns Never resolves until the process is signalled
 */
const main = async (): Promise<void> => {
	const cidrs = parseAllowCidrs(uiAllowCidr)
	let nc: NatsConnection | null = null
	let stopped = false
	let detachFeedback: (() => void) | null = null
	const log = createRejectionLog()
	const hub = createTailHub(() => nc)

	let monitorCache: { at: number; cluster: ClusterReport; connections: LiveConnection[] } | null = null

	const loadMonitor = async (): Promise<{ cluster: ClusterReport; connections: LiveConnection[] }> => {
		const now = Date.now()
		if (monitorCache && now - monitorCache.at < 5_000) return monitorCache
		const sampled = await sampleMonitor(natsMonitorUrl)
		monitorCache = { at: now, cluster: sampled.cluster, connections: sampled.connections }
		return monitorCache
	}

	const cluster = async (): Promise<ClusterReport> => (await loadMonitor()).cluster

	const connections = async (): Promise<ConnectionsReport> => {
		const sampled = await loadMonitor()
		let note: string | null = null
		let configured: ReturnType<typeof parseUsersConf> = []
		try {
			configured = parseUsersConf(readFileSync(usersConfPath, 'utf8'))
		} catch (error) {
			note = errorMessage(error)
		}
		return {
			at: sampled.cluster.at,
			error: sampled.cluster.error,
			note,
			users: buildUserRows(configured, sampled.connections),
			connections: sampled.connections,
		}
	}

	const onAir = async () => {
		const at = new Date().toISOString()
		if (!nc) {
			return { at, error: 'nats is unavailable', note: null, truncated: false, stations: [] }
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
		return { at, error: retained.error, note, truncated: retained.truncated, stations }
	}

	const rejections = async (institution: string | null) => {
		const at = new Date().toISOString()
		let error: string | null = null
		let retainedRows: ReturnType<typeof parseRejection>[] = []
		if (!nc) {
			error = 'nats is unavailable'
		} else {
			const retained = await readRetained(nc, 'feedback.>')
			error = retained.error
			retainedRows = retained.messages.map((message) => parseRejection(message.text, message.subject, message.at))
		}
		const rows = filterRejections(mergeRejections([...log.list(), ...retainedRows]), institution)
		const failure = error ?? log.liveError()
		const note = rows.length === 0 && !failure ? 'no rejection on feedback.>' : null
		return { at, error: failure, note, institution, rejections: rows }
	}

	const app = createApp({
		meta,
		cluster,
		connections,
		onAir,
		rejections,
		distDir: defaultDistDir,
	})

	let nextId = 1
	const server = Bun.serve<TailSocketData>({
		hostname: uiHost,
		port: uiPort,
		idleTimeout: 255,
		fetch: (req, bun) => {
			const ip = bun.requestIP(req)?.address ?? ''
			if (!ipAllowed(ip, cidrs)) return new Response('forbidden', { status: 403 })
			const url = new URL(req.url)
			if (url.pathname === '/api/tail') {
				const parsed = parseTailFilter(url.searchParams.get('filter'))
				if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })
				const id = nextId
				nextId += 1
				const upgraded = bun.upgrade(req, { data: { id, filter: parsed.filter, ip } })
				if (upgraded) return undefined
				return new Response('upgrade failed', { status: 400 })
			}
			return app.fetch(req)
		},
		websocket: {
			idleTimeout: 255,
			sendPings: true,
			open: (ws) => {
				const input: TailOpen = {
					id: ws.data.id,
					filter: ws.data.filter,
					ip: ws.data.ip,
					send: (frame) => {
						ws.send(frame)
					},
					close: (code, reason) => {
						ws.close(code, reason)
					},
				}
				hub.open(input)
			},
			message: (ws, message) => {
				const text = typeof message === 'string' ? message : new TextDecoder().decode(message)
				let body: unknown
				try {
					body = JSON.parse(text) as unknown
				} catch {
					return
				}
				if (typeof body === 'object' && body !== null && 'type' in body && body.type === 'beat') {
					hub.beat(ws.data.id, Date.now())
				}
			},
			close: (ws) => {
				hub.closed(ws.data.id)
			},
		},
	})

	logger.info({
		message: 'operator ui listening',
		source,
		data: {
			host: uiHost,
			port: uiPort,
			monitor: natsMonitorUrl,
			natsUrl: uiNatsUrl,
			user: uiNatsUser,
			tailIdleMs: TAIL_IDLE_MS,
			tailCapMs: TAIL_CAP_MS,
			tailMax: TAIL_MAX_CONCURRENT,
		},
	})

	const connectLoop = async (): Promise<void> => {
		for (;;) {
			if (stopped) return
			try {
				const next = await natsAccess.connect({
					servers: uiNatsUrl,
					user: uiNatsUser,
					password: uiNatsPassword,
					name: 'eventhub-operator-ui',
				})
				nc = next
				detachFeedback = attachFeedback(next, log)
				logger.info({ message: 'operator ui nats ready', source, data: { natsUrl: uiNatsUrl, user: uiNatsUser } })
				await next.closed()
			} catch (error) {
				logger.error({
					message: 'operator ui nats failed',
					source,
					error,
					data: { natsUrl: uiNatsUrl, user: uiNatsUser },
				})
			}
			detachFeedback?.()
			detachFeedback = null
			nc = null
			if (stopped) return
			await new Promise<void>((resolve) => {
				setTimeout(resolve, 3_000)
			})
		}
	}

	const shutdown = (): void => {
		if (stopped) return
		stopped = true
		hub.stop()
		detachFeedback?.()
		if (nc) void natsAccess.drain(nc)
		server.stop()
		process.exit(0)
	}
	process.on('SIGINT', shutdown)
	process.on('SIGTERM', shutdown)

	void connectLoop()
}

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

try {
	await main()
} catch (error) {
	logger.error({ message: 'operator ui failed', source, error })
	process.exit(1)
}
