import type { ClusterReport, ConnectionsReport, MetaReport, OnAirReport, RejectionsReport } from './types.ts'
import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { createApp, type UiDeps } from './server.ts'

const meta = (): MetaReport => ({
	pollMs: 8000,
	tailIdleMs: 120000,
	tailCapMs: 1800000,
	tailMax: 8,
	tailPerSecond: 20,
	defaultFilter: 'radio.*.track.playing',
	monitor: 'http://127.0.0.1:8222',
	natsUrl: 'nats://127.0.0.1:4222',
	user: 'svc-operator',
})

const cluster = (): Promise<ClusterReport> =>
	Promise.resolve({
		at: '2026-10-08T10:00:00.000Z',
		error: null,
		cluster: 'eventhub',
		leader: 'nats-2',
		clusterSize: 3,
		metaPending: 0,
		storageBytes: 0,
		storageMaxBytes: 1,
		memoryBytes: 0,
		memoryMaxBytes: 1,
		streams: 0,
		consumers: 0,
		replicas: [],
		nodes: [],
		consumerDetails: [],
	})

const connections = (): Promise<ConnectionsReport> =>
	Promise.resolve({
		at: '2026-10-08T10:00:00.000Z',
		error: null,
		note: null,
		users: [],
		connections: [],
	})

const onAir = (): Promise<OnAirReport> =>
	Promise.resolve({
		at: '2026-10-08T10:00:00.000Z',
		error: null,
		note: 'no retained radio subject on this cluster',
		truncated: false,
		stations: [],
	})

const rejections = (institution: string | null): Promise<RejectionsReport> =>
	Promise.resolve({
		at: '2026-10-08T10:00:00.000Z',
		error: null,
		note: null,
		institution,
		rejections: [],
	})

const deps = (): UiDeps => ({
	meta,
	cluster,
	connections,
	onAir,
	rejections,
	distDir: null,
})

test('stats routes answer without a websocket', async () => {
	const app = createApp(deps())
	const metaRes = await app.request('http://ui.test/api/meta')
	const clusterRes = await app.request('http://ui.test/api/cluster')
	const filtered = await app.request('http://ui.test/api/rejections?institution=urn:ard:institution:abc')
	const missing = await app.request('http://ui.test/api/nope')
	assertEquals(metaRes.status, 200)
	assertEquals(clusterRes.status, 200)
	const metaBody = await metaRes.json()
	assertEquals(metaBody.user, 'svc-operator')
	assertEquals(JSON.stringify(metaBody).includes('password'), false)
	assertEquals((await clusterRes.json()).leader, 'nats-2')
	assertEquals((await filtered.json()).institution, 'urn:ard:institution:abc')
	assertEquals(missing.status, 404)
	assertEquals(metaRes.headers.get('cache-control'), 'no-store')
})
