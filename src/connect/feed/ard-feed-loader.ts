import type { NatsConnection } from '@nats-io/transport-node'
import type { ArdFeedState, ArdFeedStore, FeedOutcome, FeedSnapshot, FollowedArdFeed, RefreshInput } from '#types'
import { readFileSync } from 'node:fs'
import { logger } from '@frytg/logger'
import { ardFeedUrl } from '../env.ts'
import { sampleMonitor } from '../ui/cluster.ts'
import { natsMonitorUrl, usersConfPath } from '../ui/env.ts'
import { parseUsersConf } from '../ui/users-conf.ts'
import { openArdFeedStore } from './ard-feed-kv.ts'
import { applyKvSnapshot, connectedInstitutionIds, decideUpstream } from './ard-feed.ts'
import { feedState } from './current-feed.ts'

const source = 'connect.ard-feed'
const FETCH_TIMEOUT_MS = 10_000

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

/**
 * Download once and write an accepted document to KV. A failure or a rejected candidate leaves KV as it was.
 * A valid document that is not newer counts as a successful fetch.
 * @param state - Serving feed, compared against and updated with the written revision
 * @param input - Store, URL, and clock
 * @returns What the download did
 */
export const refreshArdFeed = async (state: ArdFeedState, input: RefreshInput): Promise<FeedOutcome> => {
	const now = input.now ?? (() => new Date())
	const fetchFeed = input.fetchFeed ?? fetchArdFeedDocument
	state.lastAttemptAt = now().toISOString()

	if (!input.url) {
		state.outcome = 'unavailable'
		state.lastError = 'ARD_FEED_URL is unset'
		logger.info({ message: 'ARD_FEED_URL is unset', source })
		return state.outcome
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
		return state.outcome
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
		return state.outcome
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
		return state.outcome
	}

	applyKvSnapshot(state, snapshot)
	state.outcome = 'stored'
	state.lastError = null
	state.lastSuccessAt = now().toISOString()
	logger.info({
		message: 'ard feed stored',
		source,
		data: { revision: snapshot.revision, items: snapshot.feed.items.length },
	})
	return state.outcome
}

/**
 * Watch KV into `state`, read the current revision, and download only when KV has none.
 * @param state - Serving feed
 * @param input - KV store, and the download to run when KV is empty
 * @returns The KV readiness promise and the watch stop
 */
export const followArdFeed = async (
	state: ArdFeedState,
	input: { store: ArdFeedStore; download: () => Promise<unknown> }
): Promise<FollowedArdFeed> => {
	const { store, download } = input
	const { promise: kvReady, resolve } = Promise.withResolvers<void>()
	const take = (snapshot: FeedSnapshot): void => {
		if (applyKvSnapshot(state, snapshot)) {
			logger.info({
				message: 'ard feed swapped',
				source,
				data: { revision: snapshot.revision, items: snapshot.feed.items.length },
			})
		}
		if (state.feed) resolve()
	}

	const unwatch = store.watch(take)
	try {
		const stored = await store.read()
		if (stored) {
			take(stored)
		} else {
			logger.info({ message: 'no ard feed in kv, downloading', source })
			await download()
		}
	} catch (error) {
		unwatch()
		throw error
	}
	if (!state.feed) logger.warning({ message: 'waiting for ard feed in kv', source })
	return { kvReady, unwatch }
}

let activeStore: ArdFeedStore | null = null
let stopWatch: (() => void) | null = null
let inflight: Promise<FeedOutcome> | null = null

/**
 * Download, validate, and write a newer feed to KV. Every connected process picks it up through its watch.
 * Concurrent calls share one download.
 * @returns What the download did, or null when no bucket is open (NATS is down)
 */
export const updateArdFeed = (): Promise<FeedOutcome | null> => {
	const store = activeStore
	if (!store) return Promise.resolve(null)
	inflight ??= (async () => {
		try {
			return await refreshArdFeed(feedState, { store, url: ardFeedUrl, connected: await liveInstitutions() })
		} finally {
			inflight = null
		}
	})()
	return inflight
}

/**
 * Stop the watch and close the store for `updateArdFeed`.
 */
export const stopArdFeed = (): void => {
	activeStore = null
	stopWatch?.()
	stopWatch = null
}

/**
 * Open the bucket, follow it into `feedState`, and download once when KV is empty.
 * @param nc - Open NATS connection
 * @returns Resolves once the bucket is read. `kvReady` resolves once a KV revision is serving
 */
export const startArdFeed = async (nc: NatsConnection): Promise<{ kvReady: Promise<void> }> => {
	stopArdFeed()
	let store: ArdFeedStore
	try {
		store = await openArdFeedStore(nc)
	} catch (error) {
		logger.error({ message: 'ard feed bucket failed', source, error })
		throw error
	}
	activeStore = store
	const { kvReady, unwatch } = await followArdFeed(feedState, { store, download: updateArdFeed })
	stopWatch = unwatch
	return { kvReady }
}
