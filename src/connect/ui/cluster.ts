import type { ClusterNode, ClusterReport, ConsumerHealth, LiveConnection, ReplicaHealth } from './types.ts'
import { booleanField, isRecord, numberField, stringField, stringList } from './json.ts'

type VarzView = {
	name: string
	version: string | null
	uptime: string | null
	connections: number
	slowConsumers: number
	staleConnections: number
	subscriptions: number
	memBytes: number | null
	routes: number | null
	expected: string[]
}

type ConnzView = {
	total: number
	connections: LiveConnection[]
}

type Slot = {
	id: string
	varz: VarzView | null
	connz: ConnzView | null
}

type MetaView = {
	cluster: string | null
	leader: string | null
	clusterSize: number | null
	metaPending: number | null
	storageBytes: number | null
	storageMaxBytes: number | null
	memoryBytes: number | null
	memoryMaxBytes: number | null
	streams: number | null
	consumers: number | null
	replicas: ReplicaHealth[]
	consumerDetails: ConsumerHealth[]
}

/**
 * First DNS label of a cluster URL (`nats-0.nats-headless…:6222` → `nats-0`).
 * @param url - Route URL from `/varz`
 * @returns Node name
 */
const nodeNameFromUrl = (url: string): string => {
	const host = url.split(':')[0] ?? url
	return host.split('.')[0] ?? host
}

/**
 * Read a connz connection object. Username prefers `authorized_user`.
 * NATS omits that field unless the request sets `auth=1`. The JWT field is ignored.
 * @param row - One `/connz` connection
 * @param server - Server name to stamp on the row
 * @returns A live connection, or null when the row has no cid
 */
const readConnection = (row: Record<string, unknown>, server: string): LiveConnection | null => {
	const cid = numberField(row, 'cid')
	if (cid === null) return null
	const subscriptions = stringList(row.subscriptions_list ?? row.subscriptions)
	return {
		server,
		cid,
		ip: stringField(row, 'ip') ?? '',
		user: stringField(row, 'authorized_user') ?? stringField(row, 'user') ?? '',
		name: stringField(row, 'name') ?? '',
		connectedAt: stringField(row, 'start'),
		lastActivity: stringField(row, 'last_activity'),
		subscriptions,
		mqttClient: stringField(row, 'mqtt_client'),
	}
}

/**
 * Walk `/jsz` consumer detail. The same consumer reported by every node is kept once.
 * @param body - `/jsz` JSON
 * @param server - Server id, used only when the consumer is newly seen
 * @param seen - Stream/name keys already recorded
 * @returns Newly seen consumers
 */
const readConsumers = (body: Record<string, unknown>, server: string, seen: Set<string>): ConsumerHealth[] => {
	const found: ConsumerHealth[] = []
	const accounts = Array.isArray(body.account_details) ? body.account_details : []
	const streams: unknown[] = []
	if (Array.isArray(body.stream_detail)) streams.push(...body.stream_detail)
	for (const account of accounts) {
		if (!isRecord(account) || !Array.isArray(account.stream_detail)) continue
		streams.push(...account.stream_detail)
	}
	for (const stream of streams) {
		if (!isRecord(stream)) continue
		const streamName = stringField(stream, 'name') ?? ''
		const consumers = Array.isArray(stream.consumer_detail) ? stream.consumer_detail : []
		for (const consumer of consumers) {
			if (!isRecord(consumer)) continue
			const name = stringField(consumer, 'name') ?? ''
			const key = `${streamName}/${name}`
			if (seen.has(key)) continue
			seen.add(key)
			found.push({
				server,
				stream: stringField(consumer, 'stream_name') ?? streamName,
				name,
				pending: numberField(consumer, 'num_pending'),
				ackPending: numberField(consumer, 'num_ack_pending'),
				redelivered: numberField(consumer, 'num_redelivered'),
				waiting: numberField(consumer, 'num_waiting'),
			})
		}
	}
	return found
}

/**
 * Raft peers from a `/jsz` meta cluster. The leader often omits this list.
 * @param meta - `meta_cluster` object
 * @returns Replica rows, empty when the field is absent
 */
const readReplicas = (meta: Record<string, unknown>): ReplicaHealth[] => {
	if (!Array.isArray(meta.replicas)) return []
	const replicas: ReplicaHealth[] = []
	for (const replica of meta.replicas) {
		if (!isRecord(replica)) continue
		replicas.push({
			name: stringField(replica, 'name') ?? '',
			current: booleanField(replica, 'current') ?? false,
			activeNs: numberField(replica, 'active'),
		})
	}
	return replicas
}

/**
 * Cluster-wide JetStream fields. Storage totals stay with the first sample so three nodes do not triple them.
 * Raft replicas are filled from a later sample when the first one omitted the list.
 * @param body - `/jsz` JSON
 * @param current - Meta already collected, or null
 * @param server - Server id for consumer rows
 * @returns Updated meta
 */
const readMeta = (body: Record<string, unknown>, current: MetaView | null, server: string): MetaView => {
	const base: MetaView = current ?? {
		cluster: null,
		leader: null,
		clusterSize: null,
		metaPending: null,
		storageBytes: numberField(body, 'storage'),
		storageMaxBytes: isRecord(body.config) ? numberField(body.config, 'max_storage') : null,
		memoryBytes: numberField(body, 'memory'),
		memoryMaxBytes: isRecord(body.config) ? numberField(body.config, 'max_memory') : null,
		streams: numberField(body, 'streams'),
		consumers: numberField(body, 'consumers'),
		replicas: [],
		consumerDetails: [],
	}
	const seen = new Set(base.consumerDetails.map((consumer) => `${consumer.stream}/${consumer.name}`))
	const consumerDetails = [...base.consumerDetails, ...readConsumers(body, server, seen)]
	const meta = isRecord(body.meta_cluster) ? body.meta_cluster : null
	const replicas = meta ? readReplicas(meta) : []
	if (!meta || (base.leader && (base.replicas.length > 0 || replicas.length === 0))) {
		return { ...base, consumerDetails }
	}
	return {
		...base,
		cluster: stringField(meta, 'name') ?? base.cluster,
		leader: stringField(meta, 'leader') ?? base.leader,
		clusterSize: numberField(meta, 'cluster_size') ?? base.clusterSize,
		metaPending: numberField(meta, 'pending') ?? base.metaPending,
		replicas: replicas.length > 0 ? replicas : base.replicas,
		consumerDetails,
	}
}

/**
 * Fold one monitor JSON document into per-server slots.
 * `/varz`, `/connz`, and `/jsz` are told apart by shape. A load balancer may
 * answer each call from a different node, so slots join on `server_id`.
 * @param slots - Accumulator
 * @param meta - Cluster-wide JetStream view
 * @param body - Parsed JSON
 * @returns Updated meta
 */
const absorbMonitor = (slots: Map<string, Slot>, meta: MetaView | null, body: unknown): MetaView | null => {
	if (!isRecord(body)) return meta
	const id = stringField(body, 'server_id')
	if (!id) return meta
	const slot: Slot = slots.get(id) ?? { id, varz: null, connz: null }
	if (typeof body.version === 'string' && typeof body.server_name === 'string') {
		const cluster = isRecord(body.cluster) ? body.cluster : null
		const urls = cluster ? stringList(cluster.urls) : []
		slot.varz = {
			name: body.server_name,
			version: stringField(body, 'version'),
			uptime: stringField(body, 'uptime'),
			connections: numberField(body, 'connections') ?? 0,
			slowConsumers: numberField(body, 'slow_consumers') ?? 0,
			staleConnections: numberField(body, 'stale_connections') ?? 0,
			subscriptions: numberField(body, 'subscriptions') ?? 0,
			memBytes: numberField(body, 'mem'),
			routes: numberField(body, 'routes'),
			expected: urls.map(nodeNameFromUrl),
		}
		slots.set(id, slot)
		return meta
	}
	if (typeof body.num_connections === 'number') {
		const server = slot.varz?.name ?? id
		const rows = Array.isArray(body.connections) ? body.connections : []
		const connections: LiveConnection[] = []
		for (const row of rows) {
			if (!isRecord(row)) continue
			const connection = readConnection(row, server)
			if (connection) connections.push(connection)
		}
		slot.connz = { total: body.num_connections, connections }
		slots.set(id, slot)
		return meta
	}
	if (typeof body.streams === 'number') {
		slots.set(id, slot)
		return readMeta(body, meta, slot.varz?.name ?? id)
	}
	slots.set(id, slot)
	return meta
}

/**
 * The leader's `/jsz` leaves `replicas` out. A later sample from another node has the peer list.
 * One-node clusters have no peers to wait for.
 * @param meta - JetStream view so far
 * @returns Whether raft is complete enough to stop sampling
 */
const raftReady = (meta: MetaView | null): boolean => {
	if (!meta?.leader) return false
	if ((meta.clusterSize ?? 1) <= 1) return true
	return meta.replicas.length > 0
}

/**
 * True when every node named by cluster URLs has both `/varz` and `/connz`.
 * A single-node broker with no cluster URLs is done once `/varz` arrived.
 * @param slots - Accumulator
 * @returns Whether another sample round is needed
 */
const monitorCovered = (slots: Map<string, Slot>): boolean => {
	const expected = new Set<string>()
	for (const slot of slots.values()) {
		for (const name of slot.varz?.expected ?? []) expected.add(name)
	}
	if (expected.size === 0) return [...slots.values()].some((slot) => slot.varz !== null)
	for (const name of expected) {
		const slot = [...slots.values()].find((item) => item.varz?.name === name)
		if (!slot?.varz || !slot.connz) return false
	}
	return true
}

/**
 * Build the board payload. Nodes named in cluster URLs but never sampled are unreachable.
 * @param slots - Accumulator
 * @param meta - JetStream view
 * @param error - Transport error, ignored when at least one node answered
 * @param at - ISO timestamp
 * @returns Cluster report and the connection list
 */
const finalizeMonitor = (
	slots: Map<string, Slot>,
	meta: MetaView | null,
	error: string | null,
	at: string
): { cluster: ClusterReport; connections: LiveConnection[] } => {
	const nodes: ClusterNode[] = []
	const connections: LiveConnection[] = []
	const expected = new Set<string>()
	const names = new Map<string, string>()
	for (const slot of slots.values()) {
		if (slot.varz) names.set(slot.id, slot.varz.name)
	}
	for (const slot of slots.values()) {
		if (!slot.varz) {
			connections.push(...(slot.connz?.connections ?? []))
			continue
		}
		for (const name of slot.varz.expected) expected.add(name)
		const server = slot.varz.name
		for (const connection of slot.connz?.connections ?? []) {
			connections.push(connection.server === server ? connection : { ...connection, server })
		}
		nodes.push({
			name: server,
			reachable: true,
			version: slot.varz.version,
			uptime: slot.varz.uptime,
			connections: slot.connz?.total ?? slot.varz.connections,
			slowConsumers: slot.varz.slowConsumers,
			staleConnections: slot.varz.staleConnections,
			subscriptions: slot.varz.subscriptions,
			memBytes: slot.varz.memBytes,
			routes: slot.varz.routes,
		})
	}
	const seen = new Set(nodes.map((node) => node.name))
	for (const name of expected) {
		if (seen.has(name)) continue
		nodes.push({
			name,
			reachable: false,
			version: null,
			uptime: null,
			connections: 0,
			slowConsumers: 0,
			staleConnections: 0,
			subscriptions: 0,
			memBytes: null,
			routes: null,
		})
	}
	nodes.sort((a, b) => a.name.localeCompare(b.name))
	connections.sort((a, b) => a.user.localeCompare(b.user) || a.cid - b.cid)
	const cluster: ClusterReport = {
		at,
		error: nodes.some((node) => node.reachable) ? null : error,
		cluster: meta?.cluster ?? null,
		leader: meta?.leader ?? null,
		clusterSize: meta?.clusterSize ?? (expected.size > 0 ? expected.size : null),
		metaPending: meta?.metaPending ?? null,
		storageBytes: meta?.storageBytes ?? null,
		storageMaxBytes: meta?.storageMaxBytes ?? null,
		memoryBytes: meta?.memoryBytes ?? null,
		memoryMaxBytes: meta?.memoryMaxBytes ?? null,
		streams: meta?.streams ?? null,
		consumers: meta?.consumers ?? null,
		replicas: meta?.replicas ?? [],
		nodes,
		consumerDetails: (meta?.consumerDetails ?? []).map((consumer) => ({
			...consumer,
			server: names.get(consumer.server) ?? consumer.server,
		})),
	}
	return { cluster, connections }
}

export type MonitorFetch = (input: string, init?: RequestInit) => Promise<Response>

/**
 * Sample `/varz`, `/connz`, and `/jsz` until every cluster node has been seen, or rounds run out.
 * The dev monitor is one URL in front of three pods, so each request can land on a different node.
 * @param baseUrl - Monitor origin, no trailing path
 * @param fetchImpl - `fetch` or a test double
 * @param rounds - Extra passes when the first pass misses a node
 * @param width - Parallel requests per endpoint per pass
 * @returns Cluster report and connections
 */
export const sampleMonitor = async (
	baseUrl: string,
	fetchImpl: MonitorFetch = fetch,
	rounds = 4,
	width = 6
): Promise<{ cluster: ClusterReport; connections: LiveConnection[] }> => {
	const root = baseUrl.replace(/\/$/, '')
	const slots = new Map<string, Slot>()
	let meta: MetaView | null = null
	let error: string | null = null
	const pull = async (path: string): Promise<void> => {
		try {
			const response = await fetchImpl(`${root}${path}`, { signal: AbortSignal.timeout(2_500) })
			if (!response.ok) {
				error = `${path} answered ${response.status}`
				return
			}
			meta = absorbMonitor(slots, meta, await response.json())
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'monitor request failed'
		}
	}
	for (let round = 0; round < rounds; round++) {
		const jobs: Promise<void>[] = []
		for (let i = 0; i < width; i++) {
			jobs.push(pull('/varz'), pull('/connz?subs=1&auth=1&limit=1024'), pull('/jsz?streams=1&consumers=1'))
		}
		await Promise.all(jobs)
		if (monitorCovered(slots) && raftReady(meta)) break
	}
	return finalizeMonitor(slots, meta, error, new Date().toISOString())
}
