import type { ClusterReport } from '#types'
import type { OnAirLookupReport, OnAirMatch, OnAirSelector } from './on-air-query.ts'
import type { EventhubMcpSources } from './server.ts'
import { test } from '@cross/test'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { createMcpHandler } from '@modelcontextprotocol/server'
import { assertEquals } from '@std/assert'
import { app } from '../ui/server.ts'
import { createEventhubMcpServer } from './server.ts'

const cluster: ClusterReport = {
	at: '2026-10-09T10:00:00.000Z',
	error: null,
	cluster: 'eventhub',
	leader: 'nats-0',
	clusterSize: 1,
	metaPending: 0,
	storageBytes: 10,
	storageMaxBytes: 100,
	memoryBytes: 1,
	memoryMaxBytes: 50,
	streams: 2,
	consumers: 1,
	replicas: [],
	nodes: [
		{
			name: 'nats-0',
			reachable: true,
			version: '2.14.6',
			uptime: '1h',
			connections: 3,
			slowConsumers: 0,
			staleConnections: 0,
			subscriptions: 4,
			memBytes: 1,
			routes: 0,
		},
	],
	consumerDetails: [],
}

const station: OnAirMatch = {
	livestreamId: 'urn:ard:permanent-livestream:swr3',
	title: 'SWR3',
	publisherId: 'urn:ard:publisher:swr3',
	institutionId: 'urn:ard:institution:swr',
	institutionTitle: 'Südwestrundfunk',
	publisherTitle: 'SWR3',
	lastEventAt: '2026-10-09T10:00:00.000Z',
	playing: {
		title: 'Current',
		artist: 'Artist',
		publisherId: 'urn:ard:publisher:swr3',
		at: '2026-10-09T10:00:00.000Z',
	},
	next: null,
	control: null,
	data: null,
}

/**
 * Sources that record the on-air selector and return the fixture.
 * @returns Sources and the selector the last on-air call received
 */
const sources = (): { mcp: EventhubMcpSources; seen: () => OnAirSelector | null } => {
	let seen: OnAirSelector | null = null
	const onAir = async (selector: OnAirSelector): Promise<OnAirLookupReport> => {
		seen = selector
		return {
			at: '2026-10-09T10:00:00.000Z',
			error: null,
			note: null,
			truncated: false,
			stations: [station],
		}
	}
	return {
		mcp: { cluster: async () => cluster, onAir },
		seen: () => seen,
	}
}

/**
 * Call one tool through the in-process handler. No listening socket.
 * @param mcp - Tool sources
 * @param name - Tool name
 * @param args - Tool arguments
 * @returns The tool result
 */
const callTool = async (mcp: EventhubMcpSources, name: string, args: Record<string, unknown>) => {
	const handler = createMcpHandler(() => createEventhubMcpServer(mcp))
	const transport = new StreamableHTTPClientTransport(new URL('http://eventhub.test/mcp'), {
		fetch: (url, init) => handler.fetch(new Request(url, init)),
	})
	const client = new Client(
		{ name: 'eventhub-mcp-test', version: '0.0.0' },
		{ versionNegotiation: { mode: { pin: '2026-07-28' } } }
	)
	try {
		await client.connect(transport)
		return await client.callTool({ name, arguments: args })
	} finally {
		await client.close()
		await handler.close()
	}
}

test('cluster returns the monitor sample', async () => {
	const fixture = sources()
	const result = await callTool(fixture.mcp, 'cluster', {})
	assertEquals(result.isError, undefined)
	assertEquals(result.structuredContent, cluster)
})

test('on-air returns the publisher match and records the selector', async () => {
	const fixture = sources()
	const result = await callTool(fixture.mcp, 'on-air', { publisher: 'SWR3' })
	assertEquals(result.isError, undefined)
	assertEquals(fixture.seen(), { publisher: 'SWR3', institution: null })
	const body = result.structuredContent as { stations: OnAirMatch[] }
	assertEquals(body.stations[0]?.playing?.title, 'Current')
	assertEquals(body.stations[0]?.publisherTitle, 'SWR3')
})

test('on-air without a publisher or institution is an error', async () => {
	const fixture = sources()
	const result = await callTool(fixture.mcp, 'on-air', {})
	assertEquals(result.isError, true)
	assertEquals(fixture.seen(), null)
})

test('connect serves the tools at /mcp', async () => {
	const transport = new StreamableHTTPClientTransport(new URL('http://ui.test/mcp'), {
		fetch: (url, init) => app.request(url, init),
	})
	const client = new Client(
		{ name: 'eventhub-mcp-test', version: '0.0.0' },
		{ versionNegotiation: { mode: { pin: '2026-07-28' } } }
	)
	try {
		await client.connect(transport)
		const listed = await client.listTools()
		assertEquals(listed.tools.map((tool) => tool.name).toSorted(), ['cluster', 'on-air'])
	} finally {
		await client.close()
	}
})
