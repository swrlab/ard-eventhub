import type { NatsConnection } from '@nats-io/transport-node'
import type { ArdFeedState, ArdFeedStore, FeedSnapshot } from './ard-feed.ts'
import { readFileSync } from 'node:fs'
import { logger } from '@frytg/logger'
import { openArdFeedStore } from './ard-feed-kv.ts'
import {
	applyKvSnapshot,
	connectedInstitutionIds,
	decideUpstream,
	defaultBootstrapPath,
	defaultDiskPath,
	feedState,
	hydrateArdFeed,
	writeFeedFile,
} from './ard-feed.ts'
import { ardFeedUrl } from './env.ts'
import { sampleMonitor } from './ui/cluster.ts'
import { natsMonitorUrl, usersConfPath } from './ui/env.ts'
import { parseUsersConf } from './ui/users-conf.ts'

const source = 'connect.ard-feed'
const FETCH_TIMEOUT_MS = 10_000

/** One hour. The CronJob in the RFC is this interval inside the connect process until that job exists. */
const ARD_FEED_INTERVAL_MS = 60 * 60 * 1000

/**
 * Fetch side effect. Tests replace `fetch`.
 */
const ardFeedPull = {
	/**
	 * GET a URL.
	 * @param url - Request URL
	 * @param init - Fetch init
	 * @returns The response
	 */
	fetch(url: string, init?: RequestInit): Promise<Response> {
		return globalThis.fetch(url, init)
	},
}

/**
 * Download the feed JSON. Throws on a non-200 or a body that is not JSON.
 * @param url - `ARD_FEED_URL`
 * @returns Parsed JSON
 */
const fetchArdFeedDocument = async (url: string): Promise<unknown> => {
	const res = await ardFeedPull.fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
	if (res.status !== 200) throw new Error(`ARD feed HTTP ${res.status}`)
	return (await res.json()) as unknown
}

/**
 * Error text safe to log. No stack.
 * @param error - Thrown value
 * @returns Message
 */
const errorText = (error: unknown): string => (error instanceof Error ? error.message : 'ard feed request failed')

/**
 * Institution ids with a connected publisher user. Null when the monitor or the users file cannot be read,
 * which skips the check rather than rejecting a good feed.
 * @returns The set, or null
 */
const liveInstitutions = async (): Promise<Set<string> | null> => {
	try {
		const sampled = await sampleMonitor(natsMonitorUrl)
		const users = parseUsersConf(readFileSync(usersConfPath, 'utf8'))
		return connectedInstitutionIds(users, sampled.connections)
	} catch (error) {
		logger.info({
			message: 'connected institutions unread',
			source,
			data: { reason: errorText(error) },
		})
		return null
	}
}

export type RefreshInput = {
	store: ArdFeedStore
	url: string
	diskPath: string
	fetchFeed?: (url: string) => Promise<unknown>
	connected?: ReadonlySet<string> | null
	now?: () => Date
}

/**
 * Fetch once. A failure or a rejected candidate leaves `state.feed` as it was.
 * A valid document that is not newer counts as a successful fetch.
 * @param state - Serving feed
 * @param input - Store, URL, and clock
 */
export const refreshArdFeed = async (state: ArdFeedState, input: RefreshInput): Promise<void> => {
	const now = input.now ?? (() => new Date())
	const fetchFeed = input.fetchFeed ?? fetchArdFeedDocument
	state.lastAttemptAt = now().toISOString()

	if (!input.url) {
		state.outcome = 'unavailable'
		state.lastError = 'ARD_FEED_URL is unset'
		logger.info({ message: 'ARD_FEED_URL is unset', source })
		return
	}

	let candidate: unknown
	try {
		candidate = await fetchFeed(input.url)
	} catch (error) {
		state.outcome = 'unavailable'
		state.lastError = errorText(error)
		logger.warning({
			message: 'ard feed fetch failed',
			source,
			data: { reason: state.lastError },
		})
		return
	}

	const decision = decideUpstream(state.feed, candidate, input.connected)
	if (decision.action === 'keep') {
		state.outcome = decision.successful ? 'unchanged' : 'rejected'
		state.lastError = decision.successful ? null : decision.reason
		if (decision.successful) state.lastSuccessAt = now().toISOString()
		logger.log({
			level: decision.successful ? 'info' : 'warning',
			message: decision.successful ? 'ard feed unchanged' : 'ard feed rejected',
			source,
			data: { reason: decision.reason },
		})
		return
	}

	let snapshot: FeedSnapshot
	try {
		snapshot = await input.store.write(decision.feed)
	} catch (error) {
		state.outcome = 'unavailable'
		state.lastError = errorText(error)
		logger.warning({
			message: 'ard feed store failed',
			source,
			data: { reason: state.lastError },
		})
		return
	}

	state.feed = snapshot.feed
	state.revision = snapshot.revision
	state.source = 'kv'
	state.outcome = 'stored'
	state.lastError = null
	state.lastSuccessAt = now().toISOString()
	try {
		await writeFeedFile(input.diskPath, snapshot.feed)
	} catch (error) {
		logger.warning({
			message: 'ard feed disk cache failed',
			source,
			data: { reason: errorText(error) },
		})
	}
	logger.info({
		message: 'ard feed stored',
		source,
		data: { revision: snapshot.revision, items: snapshot.feed.items.length },
	})
}

let stopCurrent: (() => void) | null = null
let pulling = false

/**
 * Stop the watch and the hourly timer.
 */
export const stopArdFeed = (): void => {
	const stop = stopCurrent
	stopCurrent = null
	stop?.()
}

/**
 * Hydrate from KV, disk, or the bootstrap copy, then pull and repeat hourly.
 * One process should run this. A second process would also fetch.
 * @param nc - Open NATS connection
 */
export const startArdFeed = async (nc: NatsConnection): Promise<void> => {
	stopArdFeed()
	let store: ArdFeedStore
	try {
		store = await openArdFeedStore(nc)
	} catch (error) {
		await hydrateArdFeed(feedState, {
			readKv: () => Promise.resolve(null),
			diskPath: defaultDiskPath,
			bootstrapPath: defaultBootstrapPath,
		})
		logger.error({ message: 'ard feed bucket failed', source, error })
		throw error
	}
	await hydrateArdFeed(feedState, {
		readKv: () => store.read(),
		diskPath: defaultDiskPath,
		bootstrapPath: defaultBootstrapPath,
	})
	if (!feedState.feed) {
		logger.warning({ message: 'no ard feed cached', source })
	} else {
		logger.info({
			message: 'ard feed loaded',
			source,
			data: { from: feedState.source, revision: feedState.revision, items: feedState.feed.items.length },
		})
	}

	const unwatch = store.watch((snapshot) => {
		const swapped = applyKvSnapshot(feedState, snapshot)
		if (swapped) {
			logger.info({
				message: 'ard feed swapped',
				source,
				data: { revision: snapshot.revision, items: snapshot.feed.items.length },
			})
		}
	})

	const pull = (): void => {
		if (pulling) return
		pulling = true
		void (async () => {
			try {
				const connected = await liveInstitutions()
				await refreshArdFeed(feedState, {
					store,
					url: ardFeedUrl,
					diskPath: defaultDiskPath,
					connected,
				})
			} finally {
				pulling = false
			}
		})()
	}

	const timer = setInterval(pull, ARD_FEED_INTERVAL_MS)
	stopCurrent = () => {
		clearInterval(timer)
		unwatch()
	}
	pull()
}
