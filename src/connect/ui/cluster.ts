import type {
	ClusterNode,
	ClusterReport,
	ConsumerHealth,
	LiveConnection,
	MetaView,
	MonitorFetch,
	ReplicaHealth,
	Slot,
} from '#types'
import { booleanField, isRecord, numberField, stringField, stringList } from './json.ts'

const CONNECTION_TYPE_LABELS: Record<string, string> = {
	mqtt: 'MQTT',
	websocket: 'WEBSOCKET',
	nats: 'STANDARD',
}

/**
 * Map a `/connz` `type` onto the names in `allowed_connection_types`.
 * An MQTT client id is enough when an older monitor omits `type`.
 * @param type - connz `type` (`mqtt`, `websocket`, `nats`), or null
 * @param mqttClient - connz `mqtt_client`, or null
 * @returns `MQTT`, `WEBSOCKET`, `STANDARD`, or null when the monitor did not say
 */
const connectionType = (type: string | null, mqttClient: string | null): string | null => {
	if (type) return CONNECTION_TYPE_LABELS[type.toLowerCase()] ?? type.toUpperCase()
	if (mqttClient) return 'MQTT'
	return null
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
	const mqttClient = stringField(row, 'mqtt_client')
	return {
		server,
		cid,
		ip: stringField(row, 'ip') ?? '',
		user: stringField(row, 'authorized_user') ?? stringField(row, 'user') ?? '',
		name: stringField(row, 'name') ?? '',
		connectedAt: stringField(row, 'start'),
		lastActivity: stringField(row, 'last_activity'),
		subscriptions,
		type: connectionType(stringField(row, 'type'), mqttClient),
		mqttClient,
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
 * Raft peers from a `/jsz` meta cluster. Only the meta leader reports this list.
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
 * Raft replicas are filled from a later sample when the first one omitted the list (a non-leader answered first).
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
 * Remote server names from `/routez`. Route pooling opens several connections per peer, so names are deduplicated.
 * @param body - `/routez` JSON
 * @returns Unique `remote_name` values, sorted
 */
const readPeers = (body: Record<string, unknown>): string[] => {
	const rows = Array.isArray(body.routes) ? body.routes : []
	const names = new Set<string>()
	for (const row of rows) {
		if (!isRecord(row)) continue
		const name = stringField(row, 'remote_name')
		if (name) names.add(name)
	}
	return [...names].toSorted()
}

/**
 * Fold one monitor JSON document into per-server slots.
 * `/varz`, `/connz`, `/routez`, and `/jsz` are told apart by shape. A load balancer may
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
	const slot: Slot = slots.get(id) ?? { id, varz: null, connz: null, peers: null }
	if (typeof body.version === 'string' && typeof body.server_name === 'string') {
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
		}
		slots.set(id, slot)
		return meta
	}
	if (typeof body.num_routes === 'number') {
		slot.peers = readPeers(body)
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
 * Only the meta leader's `/jsz` lists raft replicas. When the leader sits behind another machine's monitor,
 * no amount of sampling here returns that list. One-node clusters have no peers to wait for.
 * @param meta - JetStream view so far
 * @param slots - Accumulator, to tell whether the leader is a node this monitor reaches
 * @returns Whether raft is complete enough to stop sampling
 */
const raftReady = (meta: MetaView | null, slots: Map<string, Slot>): boolean => {
	if (!meta?.leader) return false
	if ((meta.clusterSize ?? 1) <= 1) return true
	const leader = meta.leader
	if (![...slots.values()].some((slot) => slot.varz?.name === leader)) return true
	return meta.replicas.length > 0
}

/**
 * True when every node that answered `/varz` also answered `/connz` and `/routez`.
 * Peers on other machines are never waited for: their monitor port is not reachable from here.
 * @param slots - Accumulator
 * @returns Whether the sampled nodes are complete
 */
const monitorCovered = (slots: Map<string, Slot>): boolean => {
	const sampled = [...slots.values()].filter((slot) => slot.varz !== null)
	if (sampled.length === 0) return false
	return sampled.every((slot) => slot.connz !== null && slot.peers !== null)
}

/**
 * Build the board payload. Sampled nodes carry their own stats. Other peers come from `/routez`
 * remote names and raft replicas: a live route marks them reachable, a raft peer without one is unreachable.
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
	const routed = new Set<string>()
	const names = new Map<string, string>()
	for (const slot of slots.values()) {
		if (slot.varz) names.set(slot.id, slot.varz.name)
	}
	for (const slot of slots.values()) {
		if (!slot.varz) {
			connections.push(...(slot.connz?.connections ?? []))
			continue
		}
		for (const name of slot.peers ?? []) routed.add(name)
		const server = slot.varz.name
		for (const connection of slot.connz?.connections ?? []) {
			connections.push(connection.server === server ? connection : { ...connection, server })
		}
		nodes.push({
			name: server,
			reachable: true,
			sampled: true,
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
	const peers = new Set(routed)
	for (const replica of meta?.replicas ?? []) peers.add(replica.name)
	if (meta?.leader) peers.add(meta.leader)
	const seen = new Set(nodes.map((node) => node.name))
	for (const name of peers) {
		if (seen.has(name)) continue
		seen.add(name)
		nodes.push({
			name,
			reachable: routed.has(name),
			sampled: false,
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
		clusterSize: meta?.clusterSize ?? (nodes.length > 0 ? nodes.length : null),
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

/**
 * Sample `/varz`, `/connz`, `/routez`, and `/jsz` until every node behind the monitor URL is complete, or rounds run out.
 * Each machine's monitor is one pod, so other machines show up through routes and raft, not their own stats.
 * A URL in front of several pods still works: each request can land on a different node and slots join on `server_id`.
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
			jobs.push(
				pull('/varz'),
				pull('/connz?subs=1&auth=1&limit=1024'),
				pull('/routez'),
				pull('/jsz?streams=1&consumers=1')
			)
		}
		await Promise.all(jobs)
		if (monitorCovered(slots) && raftReady(meta, slots)) break
	}
	return finalizeMonitor(slots, meta, error, new Date().toISOString())
}
