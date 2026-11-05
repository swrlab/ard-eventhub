import type { ClusterReport } from '#types'
import type { OnAirLookupReport, OnAirSelector } from './on-air-query.ts'
import type { EventhubMcpSources } from './server.ts'
import { knownLivestreams } from '../../utils/feed/known-livestreams.ts'
import { currentFeed } from '../feed/current-feed.ts'
import { sampleMonitor } from '../ui/cluster.ts'
import { natsMonitorUrl } from '../ui/env.ts'
import { foldOnAir, nameOnAirStations } from '../ui/on-air.ts'
import { readRetained } from '../ui/retained.ts'
import { currentConnection } from '../ui/session.ts'
import { selectOnAir } from './on-air-query.ts'

/**
 * Parsed JSON, or null when the retained payload is not JSON.
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
 * Cluster board sample from the HTTP monitor.
 * @returns Cluster report
 */
const loadCluster = async (): Promise<ClusterReport> => (await sampleMonitor(natsMonitorUrl)).cluster

/**
 * On-air board for one publisher or institution.
 * Uses the connection and feed this connect process is already serving.
 * @param selector - Publisher and institution queries
 * @returns Lookup report
 */
const loadOnAir = async (selector: OnAirSelector): Promise<OnAirLookupReport> => {
	const at = new Date().toISOString()
	const nc = currentConnection()
	if (!nc) return { at, error: 'nats is unavailable', note: null, truncated: false, stations: [] }
	const catalog = knownLivestreams(currentFeed())
	const retained = await readRetained(nc, 'radio.>')
	const named = nameOnAirStations(
		foldOnAir(
			retained.messages.map((message) => ({
				subject: message.subject,
				at: message.at,
				payload: parseJson(message.text),
			}))
		),
		catalog
	)
	const selected = selectOnAir(named, catalog, selector)
	return {
		at,
		error: retained.error,
		note: selected.note,
		truncated: retained.truncated,
		stations: selected.stations,
	}
}

/** Readers backed by this connect process. */
export const liveSources: EventhubMcpSources = {
	cluster: loadCluster,
	onAir: loadOnAir,
}
