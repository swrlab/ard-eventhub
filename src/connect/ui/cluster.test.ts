import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { sampleMonitor, type MonitorFetch } from './cluster.ts'

const urls = [
	'nats-0.nats-headless.eventhub-dev.svc.cluster.local:6222',
	'nats-1.nats-headless.eventhub-dev.svc.cluster.local:6222',
	'nats-2.nats-headless.eventhub-dev.svc.cluster.local:6222',
]

const names = ['nats-0', 'nats-1', 'nats-2']
const ids = ['id-0', 'id-1', 'id-2']

/**
 * JSON response double.
 * @param body - Payload
 * @returns A successful response
 */
const json = (body: unknown): Response => Response.json(body)

/**
 * A monitor that round-robins three nodes per endpoint.
 * @returns Fetch double and nothing else
 */
const rotatingFetch = (): MonitorFetch => {
	const cursor = { varz: 0, connz: 0, jsz: 0 }
	return async (input) => {
		if (input.includes('/varz')) {
			const i = cursor.varz % 3
			cursor.varz += 1
			return json({
				server_id: ids[i],
				server_name: names[i],
				version: '2.14.6',
				uptime: '2h',
				connections: 0,
				slow_consumers: i === 1 ? 2 : 0,
				stale_connections: 0,
				subscriptions: 4,
				mem: 1024,
				routes: 2,
				cluster: { name: 'eventhub', urls },
			})
		}
		if (input.includes('/connz')) {
			const i = cursor.connz % 3
			cursor.connz += 1
			const live = i === 0
			return json({
				server_id: ids[i],
				num_connections: live ? 1 : 0,
				connections: live
					? [
							{
								cid: 7,
								ip: '10.0.0.8',
								authorized_user: 'pub-swr-2026-06-26',
								name: 'playout',
								start: '2026-10-08T10:00:00Z',
								last_activity: '2026-10-08T10:05:00Z',
								subscriptions_list: ['inbox.urn:ard:institution:a3004ff924ece1a2'],
								mqtt_client: 'swr',
							},
						]
					: [],
			})
		}
		const i = cursor.jsz % 3
		cursor.jsz += 1
		return json({
			server_id: ids[i],
			streams: 1,
			consumers: 1,
			storage: 10,
			memory: 0,
			config: { max_storage: 1_000_000_000, max_memory: 128_000_000 },
			meta_cluster: {
				name: 'eventhub',
				leader: 'nats-2',
				cluster_size: 3,
				pending: 0,
				replicas: [
					{ name: 'nats-0', current: true, active: 900_000_000 },
					{ name: 'nats-1', current: false, active: 5_000_000_000 },
				],
			},
			account_details: [
				{
					name: '$G',
					stream_detail: [
						{
							name: 'INBOX',
							consumer_detail: [
								{
									name: 'sidecar',
									stream_name: 'INBOX',
									num_pending: 4,
									num_ack_pending: 2,
									num_redelivered: 1,
									num_waiting: 0,
								},
							],
						},
					],
				},
			],
		})
	}
}

test('monitor sampling joins three load-balanced nodes without tripling jetstream', async () => {
	const sampled = await sampleMonitor('http://leno0:8222', rotatingFetch())
	assertEquals(
		sampled.cluster.nodes.map((node) => node.name),
		['nats-0', 'nats-1', 'nats-2']
	)
	assertEquals(
		sampled.cluster.nodes.every((node) => node.reachable),
		true
	)
	assertEquals(sampled.cluster.leader, 'nats-2')
	assertEquals(sampled.cluster.cluster, 'eventhub')
	assertEquals(sampled.cluster.storageMaxBytes, 1_000_000_000)
	assertEquals(sampled.cluster.streams, 1)
	assertEquals(sampled.cluster.consumerDetails.length, 1)
	assertEquals(sampled.cluster.consumerDetails[0]?.name, 'sidecar')
	assertEquals(sampled.cluster.consumerDetails[0]?.ackPending, 2)
	assertEquals(sampled.cluster.nodes[1]?.slowConsumers, 2)
	assertEquals(sampled.connections.length, 1)
	assertEquals(sampled.connections[0]?.user, 'pub-swr-2026-06-26')
	assertEquals(sampled.connections[0]?.server, 'nats-0')
	assertEquals(sampled.cluster.error, null)
})

/**
 * Monitor that only ever answers as nats-0, while advertising three cluster URLs.
 * @param input - Request URL
 * @returns JSON response
 */
const singleNodeFetch: MonitorFetch = async (input) => {
	if (input.includes('/varz')) {
		return json({
			server_id: 'id-0',
			server_name: 'nats-0',
			version: '2.14.6',
			uptime: '1m',
			connections: 0,
			slow_consumers: 0,
			stale_connections: 0,
			subscriptions: 0,
			mem: 1,
			routes: 0,
			cluster: { urls },
		})
	}
	if (input.includes('/connz')) {
		return json({ server_id: 'id-0', num_connections: 0, connections: [] })
	}
	return json({ server_id: 'id-0', streams: 0, consumers: 0, storage: 0, memory: 0, config: {} })
}

test('raft replicas fill in when the first jetstream sample omits them', async () => {
	let jsz = 0
	const fetchImpl: MonitorFetch = async (input) => {
		if (input.includes('/varz')) {
			return json({
				server_id: 'id-0',
				server_name: 'nats-0',
				version: '2.14.6',
				uptime: '1m',
				connections: 0,
				slow_consumers: 0,
				stale_connections: 0,
				subscriptions: 0,
				mem: 1,
				routes: 2,
				cluster: { urls: ['nats-0.nats.svc:6222'] },
			})
		}
		if (input.includes('/connz')) return json({ server_id: 'id-0', num_connections: 0, connections: [] })
		jsz += 1
		const withPeers = jsz > 1
		return json({
			server_id: 'id-0',
			streams: 2,
			consumers: 0,
			storage: 10,
			memory: 0,
			config: { max_storage: 100 },
			meta_cluster: {
				name: 'eventhub',
				leader: 'nats-0',
				cluster_size: 3,
				pending: 0,
				...(withPeers ? { replicas: [{ name: 'nats-1', current: true, active: 1000 }] } : {}),
			},
		})
	}
	const sampled = await sampleMonitor('http://127.0.0.1:8222', fetchImpl, 4, 1)
	assertEquals(sampled.cluster.streams, 2)
	assertEquals(sampled.cluster.storageBytes, 10)
	assertEquals(sampled.cluster.replicas.map((replica) => replica.name), ['nats-1'])
})

test('a node that never answers is listed unreachable', async () => {
	const sampled = await sampleMonitor('http://127.0.0.1:8222', singleNodeFetch)
	const down = sampled.cluster.nodes.filter((node) => !node.reachable).map((node) => node.name)
	assertEquals(down, ['nats-1', 'nats-2'])
	assertEquals(sampled.cluster.nodes[0]?.reachable, true)
})
