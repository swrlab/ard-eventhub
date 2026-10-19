import type { ClusterReport } from '#types'
import type { OnAirLookupReport, OnAirSelector } from './on-air-query.ts'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import packageJson from '../../../package.json' with { type: 'json' }
import { errorMessage } from '../ui/json.ts'

/** Cluster sample and on-air lookup. Tests pass fakes; `live.ts` talks to NATS. */
export type EventhubMcpSources = {
	/**
	 * Current cluster sample, the same shape as the operator cluster board.
	 * @returns Cluster report
	 */
	cluster: () => Promise<ClusterReport>
	/**
	 * Latest retained radio state for one publisher or institution.
	 * @param selector - Publisher and institution queries
	 * @returns Lookup report
	 */
	onAir: (selector: OnAirSelector) => Promise<OnAirLookupReport>
}

const nullableString = z.string().nullable()
const nullableNumber = z.number().nullable()

const clusterOutput = z.object({
	at: z.string(),
	error: nullableString,
	cluster: nullableString,
	leader: nullableString,
	clusterSize: nullableNumber,
	metaPending: nullableNumber,
	storageBytes: nullableNumber,
	storageMaxBytes: nullableNumber,
	memoryBytes: nullableNumber,
	memoryMaxBytes: nullableNumber,
	streams: nullableNumber,
	consumers: nullableNumber,
	replicas: z.array(
		z.object({
			name: z.string(),
			current: z.boolean(),
			activeNs: nullableNumber,
		})
	),
	nodes: z.array(
		z.object({
			name: z.string(),
			reachable: z.boolean(),
			version: nullableString,
			uptime: nullableString,
			connections: z.number(),
			slowConsumers: z.number(),
			staleConnections: z.number(),
			subscriptions: z.number(),
			memBytes: nullableNumber,
			routes: nullableNumber,
		})
	),
	consumerDetails: z.array(
		z.object({
			server: z.string(),
			stream: z.string(),
			name: z.string(),
			pending: nullableNumber,
			ackPending: nullableNumber,
			redelivered: nullableNumber,
			waiting: nullableNumber,
		})
	),
})

const trackOutput = z.object({
	title: nullableString,
	artist: nullableString,
	publisherId: nullableString,
	at: nullableString,
})

const onAirOutput = z.object({
	at: z.string(),
	error: nullableString,
	note: nullableString,
	truncated: z.boolean(),
	publisher: nullableString,
	institution: nullableString,
	stations: z.array(
		z.object({
			livestreamId: z.string(),
			title: nullableString,
			publisherId: nullableString,
			institutionId: nullableString,
			institutionTitle: nullableString,
			publisherTitle: nullableString,
			lastEventAt: nullableString,
			playing: trackOutput.nullable(),
			next: trackOutput.nullable(),
			control: z
				.object({
					name: nullableString,
					state: z.boolean().nullable(),
					validUntil: nullableString,
					at: nullableString,
				})
				.nullable(),
			data: z
				.object({
					text: nullableString,
					at: nullableString,
				})
				.nullable(),
		})
	),
})

type ClusterOutput = z.infer<typeof clusterOutput>
type OnAirOutput = z.infer<typeof onAirOutput>

/**
 * Cluster report as the tool's structured result.
 * @param report - Monitor sample
 * @returns Schema-shaped cluster
 */
const clusterBody = (report: ClusterReport): ClusterOutput => report

/**
 * One line per node for the text block.
 * @param report - Monitor sample
 * @returns A short cluster summary
 */
const summarizeCluster = (report: ClusterReport): string => {
	const nodes = report.nodes
		.map((node) => `${node.name} ${node.reachable ? 'reachable' : 'unreachable'} connections=${node.connections}`)
		.join('; ')
	return [
		`cluster ${report.cluster ?? 'unknown'}`,
		`leader ${report.leader ?? 'unknown'}`,
		`storageBytes ${report.storageBytes ?? 'unknown'} / ${report.storageMaxBytes ?? 'unknown'}`,
		`streams ${report.streams ?? 'unknown'} consumers ${report.consumers ?? 'unknown'}`,
		nodes || 'no nodes',
		report.error ?? '',
	]
		.filter((line) => line.length > 0)
		.join('\n')
}

/**
 * One block per station for the text block. The structured result keeps the full fields.
 * @param report - Lookup
 * @returns A short on-air summary
 */
const summarizeOnAir = (report: OnAirOutput): string => {
	if (report.stations.length === 0) return report.note ?? report.error ?? 'no livestream'
	return report.stations
		.map((station) => {
			const name = station.publisherTitle ?? station.title ?? station.livestreamId
			const playing = station.playing?.title
				? `playing ${station.playing.title}${station.playing.artist ? ` — ${station.playing.artist}` : ''}`
				: 'nothing retained'
			const house = station.institutionTitle ?? station.institutionId ?? ''
			return [name, house, playing, station.livestreamId].filter((part) => part.length > 0).join(' · ')
		})
		.join('\n')
}

/**
 * Tool result with a text block and the structured body the schema describes.
 * @param text - Summary the model reads
 * @param output - Structured body
 * @returns MCP tool result
 */
const ok = <T extends Record<string, unknown>>(text: string, output: T) => ({
	content: [{ type: 'text' as const, text }],
	structuredContent: output,
})

/**
 * Build the Eventhub MCP server. The connect process mounts one of these per `/mcp` request.
 * @param sources - Cluster and on-air readers
 * @returns A server with the `cluster` and `on-air` tools
 */
export const createEventhubMcpServer = (sources: EventhubMcpSources): McpServer => {
	const server = new McpServer({ name: 'ard-eventhub', version: packageJson.version })

	server.registerTool(
		'cluster',
		{
			title: 'Cluster',
			description:
				'NATS cluster health for Eventhub Connect: leader, JetStream storage, whether each node answered, raft replicas, and consumers. Same sample as the operator cluster board.',
			inputSchema: z.object({}),
			outputSchema: clusterOutput,
			annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
		},
		async () => {
			try {
				const report = clusterBody(await sources.cluster())
				return ok(summarizeCluster(report), report)
			} catch (error) {
				const message = errorMessage(error)
				return { content: [{ type: 'text' as const, text: message }], isError: true }
			}
		}
	)

	server.registerTool(
		'on-air',
		{
			title: 'On air',
			description:
				'Latest retained radio state for a livestream publisher or institution: what is playing, the next track, the control flag, and radiotext. Pass a publisher URN or title, an institution URN or title, or both. A title fragment matches (SWR matches SWR3). A URN matches only in full. Stations the feed lists with nothing retained are included with empty track fields. Same fields as the operator on-air board.',
			inputSchema: z.object({
				publisher: z
					.string()
					.trim()
					.min(1)
					.optional()
					.describe('Publisher URN or title, for example urn:ard:publisher:… or SWR3'),
				institution: z
					.string()
					.trim()
					.min(1)
					.optional()
					.describe('Institution URN or title, for example urn:ard:institution:… or Südwestrundfunk'),
			}),
			outputSchema: onAirOutput,
			annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
		},
		async ({ publisher, institution }) => {
			const selector: OnAirSelector = {
				publisher: publisher ?? null,
				institution: institution ?? null,
			}
			if (!selector.publisher && !selector.institution) {
				return {
					content: [{ type: 'text' as const, text: 'Pass a publisher or an institution' }],
					isError: true,
				}
			}
			try {
				const report = await sources.onAir(selector)
				const output: OnAirOutput = {
					...report,
					publisher: selector.publisher,
					institution: selector.institution,
				}
				return ok(summarizeOnAir(output), output)
			} catch (error) {
				const message = errorMessage(error)
				const output: OnAirOutput = {
					at: new Date().toISOString(),
					error: message,
					note: null,
					truncated: false,
					publisher: selector.publisher,
					institution: selector.institution,
					stations: [],
				}
				return ok(message, output)
			}
		}
	)

	return server
}
