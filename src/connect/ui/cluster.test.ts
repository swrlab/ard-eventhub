import type { MonitorFetch } from '#types'
import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { sampleMonitor } from './cluster.ts'

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
	const cursor = { varz: 0, connz: 0, routez: 0, jsz: 0 }
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
				cluster: { name: 'eventhub' },
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
								type: 'mqtt',
								mqtt_client: 'swr',
							},
						]
					: [],
			})
		}
		if (input.includes('/routez')) {
			const i = cursor.routez % 3
			cursor.routez += 1
			const routes = names.filter((_, j) => j !== i).map((name) => ({ remote_name: name }))
			return json({ server_id: ids[i], num_routes: routes.length, routes })
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
	const sampled = await sampleMonitor('http://127.0.0.1:8222', rotatingFetch())
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
	assertEquals(sampled.connections[0]?.type, 'MQTT')
	assertEquals(sampled.connections[0]?.server, 'nats-0')
	assertEquals(sampled.cluster.error, null)
})

/**
 * One machine of the multi-host dev cluster: its monitor only ever answers as itself.
 * Route URLs use machine hostnames (`eventhub-connect-<zone>-dev`), server names match their first label.
 * @param peers - Remote names `/routez` reports, with route pooling duplicating each one
 * @param raft - Raft replica names in `/jsz`
 * @returns Fetch double
 */
const machineFetch =
	(peers: string[], raft: string[]): MonitorFetch =>
	async (input) => {
		if (input.includes('/varz')) {
			return json({
				server_id: 'id-stg',
				server_name: 'eventhub-connect-stg-dev',
				version: '2.14.6',
				uptime: '1m',
				connections: 0,
				slow_consumers: 0,
				stale_connections: 0,
				subscriptions: 0,
				mem: 1,
				routes: peers.length * 3,
				cluster: {
					name: 'eventhub-dev',
					urls: ['bad', 'stg', 'mnz'].map((zone) => `eventhub-connect-${zone}-dev.swr.ard:26222`),
				},
			})
		}
		if (input.includes('/connz')) return json({ server_id: 'id-stg', num_connections: 0, connections: [] })
		if (input.includes('/routez')) {
			const routes = peers.flatMap((name) => [1, 2, 3].map(() => ({ remote_name: name })))
			return json({ server_id: 'id-stg', server_name: 'eventhub-connect-stg-dev', num_routes: routes.length, routes })
		}
		return json({
			server_id: 'id-stg',
			streams: 0,
			consumers: 0,
			storage: 0,
			memory: 0,
			config: {},
			meta_cluster: {
				name: 'eventhub-dev',
				leader: 'eventhub-connect-bad-dev',
				cluster_size: 3,
				pending: 0,
				replicas: raft.map((name) => ({ name, current: true, active: 1000 })),
			},
		})
	}

test('peers on other machines come from routes, not route hostnames', async () => {
	const sampled = await sampleMonitor(
		'http://127.0.0.1:8222',
		machineFetch(['eventhub-connect-bad-dev', 'eventhub-connect-mnz-dev'], ['eventhub-connect-mnz-dev']),
		1,
		1
	)
	assertEquals(
		sampled.cluster.nodes.map((node) => `${node.name}:${node.reachable}:${node.sampled}`),
		['eventhub-connect-bad-dev:true:false', 'eventhub-connect-mnz-dev:true:false', 'eventhub-connect-stg-dev:true:true']
	)
	assertEquals(sampled.cluster.clusterSize, 3)
})

test('a raft peer without a live route is listed unreachable', async () => {
	const sampled = await sampleMonitor(
		'http://127.0.0.1:8222',
		machineFetch(['eventhub-connect-bad-dev'], ['eventhub-connect-mnz-dev']),
		1,
		1
	)
	const down = sampled.cluster.nodes.filter((node) => !node.reachable).map((node) => node.name)
	assertEquals(down, ['eventhub-connect-mnz-dev'])
})

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
	assertEquals(
		sampled.cluster.replicas.map((replica) => replica.name),
		['nats-1']
	)
})

/**
 * One node reporting mqtt, websocket, nats, and an MQTT client id with no type.
 * @param input - Request URL
 * @returns JSON response
 */
const typedConnzFetch: MonitorFetch = async (input) => {
	if (input.includes('/varz')) {
		return json({
			server_id: 'id-0',
			server_name: 'nats-0',
			version: '2.14.6',
			uptime: '1m',
			connections: 4,
			slow_consumers: 0,
			stale_connections: 0,
			subscriptions: 0,
			mem: 1,
			routes: 0,
			cluster: { urls: ['nats-0.nats.svc:6222'] },
		})
	}
	if (input.includes('/connz')) {
		return json({
			server_id: 'id-0',
			num_connections: 4,
			connections: [
				{ cid: 1, type: 'mqtt', mqtt_client: 'swr', authorized_user: 'a' },
				{ cid: 2, type: 'websocket', authorized_user: 'b' },
				{ cid: 3, type: 'nats', authorized_user: 'c' },
				{ cid: 4, mqtt_client: 'legacy', authorized_user: 'd' },
			],
		})
	}
	return json({ server_id: 'id-0', streams: 0, consumers: 0, storage: 0, memory: 0, config: {} })
}

test('connz type uses the same names as allowed_connection_types', async () => {
	const sampled = await sampleMonitor('http://127.0.0.1:8222', typedConnzFetch, 1, 1)
	assertEquals(
		sampled.connections.map((row) => `${row.user}:${row.type}`),
		['a:MQTT', 'b:WEBSOCKET', 'c:STANDARD', 'd:MQTT']
	)
})

test('a machine that is not the meta leader stops after one round', async () => {
	const inner = machineFetch(['eventhub-connect-bad-dev', 'eventhub-connect-mnz-dev'], [])
	let varz = 0
	const fetchImpl: MonitorFetch = async (input, init) => {
		if (input.includes('/varz')) varz += 1
		return inner(input, init)
	}
	const sampled = await sampleMonitor('http://127.0.0.1:8222', fetchImpl, 4, 1)
	assertEquals(varz, 1)
	assertEquals(sampled.cluster.replicas, [])
})
