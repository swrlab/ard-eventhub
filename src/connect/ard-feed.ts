import type { ArdFeed } from '#types'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { getArdFeedValidationError } from '../utils/ard-feed-rules.ts'

/** JetStream stream that holds the feed. KV subjects live under `$KV.ARD_FEED.>`. */
export const ARD_FEED_STREAM = 'KV_ARD_FEED'

/** One document per revision. History is `max_msgs_per_subject` on the stream. */
export const ARD_FEED_SUBJECT = '$KV.ARD_FEED.livestreams'

/** Missed refreshes. The pull interval is one hour. */
export const FEED_STALE_WARN_MS = 3 * 60 * 60 * 1000

/** Twelve missed refreshes. */
export const FEED_STALE_ALERT_MS = 12 * 60 * 60 * 1000

/** Two days without a valid fetch. */
export const FEED_STALE_PAGE_MS = 48 * 60 * 60 * 1000

/** Where a loaded snapshot came from. */
type FeedSource = 'kv' | 'disk' | 'bootstrap'

/** What the last pull did. */
type FeedOutcome = 'stored' | 'unchanged' | 'rejected' | 'unavailable'

/** How late the last successful fetch is. `never` means this process has not stored or confirmed one. */
export type FeedStaleness = 'ok' | 'warn' | 'alert' | 'page' | 'never'

/** One accepted document plus its JetStream sequence. */
export type FeedSnapshot = {
	feed: ArdFeed
	revision: number
}

/**
 * Shared store. The JetStream bucket is the production one. Tests pass a memory double.
 */
export type ArdFeedStore = {
	/**
	 * Latest accepted document, or null when the bucket is empty or the bytes fail validation.
	 */
	read: () => Promise<FeedSnapshot | null>
	/**
	 * Append a new revision.
	 * @param feed - Document that already passed the upstream checks
	 * @returns The stored snapshot, including the new sequence
	 */
	write: (feed: ArdFeed) => Promise<FeedSnapshot>
	/**
	 * Call `onSnapshot` for revisions published after the watch starts.
	 * @param onSnapshot - Validated revision
	 * @returns Stops the watch
	 */
	watch: (onSnapshot: (snapshot: FeedSnapshot) => void) => () => void
}

/** Result of comparing a fetched candidate with the feed that is serving. */
export type UpstreamDecision =
	| { action: 'store'; feed: ArdFeed }
	| { action: 'keep'; reason: string; successful: boolean }

/** In-memory feed this process is serving. */
export type ArdFeedState = {
	feed: ArdFeed | null
	revision: number | null
	source: FeedSource | null
	lastSuccessAt: string | null
	lastAttemptAt: string | null
	lastError: string | null
	outcome: FeedOutcome | null
}

/** JSON the operator UI polls. */
export type FeedReport = {
	at: string
	source: FeedSource | null
	revision: number | null
	generatedAt: string | null
	itemCount: number | null
	institutionCount: number | null
	ageMs: number | null
	lastSuccessAt: string | null
	lastAttemptAt: string | null
	lastError: string | null
	staleness: FeedStaleness
	outcome: FeedOutcome | null
}

/** Last good copy on disk. Gitignored via `.local/`. */
export const defaultDiskPath = join(import.meta.dir, '../../.local/ard-feed.json')

/** Gzip snapshot shipped with the process. Cold start uses it when KV and disk are empty. */
export const defaultBootstrapPath = join(import.meta.dir, 'bootstrap/ard-feed.json.gz')

/**
 * Empty state, before hydrate.
 * @returns A state with no feed
 */
export const createArdFeedState = (): ArdFeedState => ({
	feed: null,
	revision: null,
	source: null,
	lastSuccessAt: null,
	lastAttemptAt: null,
	lastError: null,
	outcome: null,
})

/** Process-wide feed. The loader writes it. `/api/feed` reads it. */
export const feedState: ArdFeedState = createArdFeedState()

/**
 * `generatedAt` from the live API, or the older `generated` field.
 * @param feed - Parsed feed
 * @returns ISO timestamp, or null
 */
export const feedGeneratedAt = (feed: ArdFeed): string | null => {
	const record = feed as ArdFeed & { generatedAt?: unknown }
	const value = record.generatedAt ?? feed.generated
	return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Parse a feed timestamp.
 * @param feed - Parsed feed
 * @returns Epoch ms, or null when the field is missing or not a date
 */
const generatedMs = (feed: ArdFeed): number | null => {
	const raw = feedGeneratedAt(feed)
	if (!raw) return null
	const ms = Date.parse(raw)
	return Number.isNaN(ms) ? null : ms
}

/**
 * Livestream id → institution id. Built when a snapshot is swapped in.
 * @param feed - Accepted feed
 * @returns One entry per livestream that has a publisher and an institution id
 */
const institutionIds = (feed: ArdFeed): Set<string> => {
	const ids = new Set<string>()
	for (const item of feed.items) {
		const id = item.publisher?.institution?.id
		if (typeof id === 'string' && id.length > 0) ids.add(id)
	}
	return ids
}

/**
 * Institutions whose NATS user is connected right now.
 * A name with no institution URN in its allow list contributes nothing.
 * @param users - Configured users and the institution URNs in their allow subjects
 * @param connections - Live sockets. `user` is the authorized username
 * @returns Institution ids that must still be in the next feed
 */
export const connectedInstitutionIds = (
	users: readonly { username: string; institutions: readonly string[] }[],
	connections: readonly { user: string }[]
): Set<string> => {
	const byUser = new Map(users.map((user) => [user.username, user.institutions]))
	const ids = new Set<string>()
	for (const connection of connections) {
		if (!connection.user) continue
		for (const id of byUser.get(connection.user) ?? []) ids.add(id)
	}
	return ids
}

/**
 * Whether a fetched candidate may replace `active`.
 * Absolute rules (item count, pagination, canary stations) always apply.
 * Relative rules apply only when there is already a feed: institution count must not drop,
 * a connected institution must not disappear, and `generatedAt` must be newer.
 * A valid document that is simply not newer is a successful fetch that leaves the current feed up.
 * @param active - Feed serving now, or null on a cold start
 * @param candidate - Parsed JSON from the upstream
 * @param connected - Institution ids with a live connection. Null skips that check (monitor unread)
 * @returns Store the candidate, or keep the previous one
 */
export const decideUpstream = (
	active: ArdFeed | null,
	candidate: unknown,
	connected?: ReadonlySet<string> | null
): UpstreamDecision => {
	const validationError = getArdFeedValidationError(candidate)
	if (validationError) return { action: 'keep', reason: validationError, successful: false }
	const next = candidate as ArdFeed
	if (!active) return { action: 'store', feed: next }

	if (connected) {
		const present = institutionIds(next)
		for (const id of connected) {
			if (!present.has(id))
				return { action: 'keep', reason: `connected institution missing > ${id}`, successful: false }
		}
	}

	const previousCount = institutionIds(active).size
	const nextCount = institutionIds(next).size
	if (previousCount > 0 && nextCount < previousCount) {
		return {
			action: 'keep',
			reason: `institution count dropped > ${nextCount} < ${previousCount}`,
			successful: false,
		}
	}

	const previousMs = generatedMs(active)
	const nextMs = generatedMs(next)
	if (previousMs !== null) {
		if (nextMs === null) return { action: 'keep', reason: 'generated is missing', successful: false }
		if (nextMs <= previousMs) return { action: 'keep', reason: 'generated is not newer', successful: true }
	}

	return { action: 'store', feed: next }
}

/**
 * How late `lastSuccessAt` is.
 * @param lastSuccessAt - ISO time of the last valid fetch, or null
 * @param now - Current epoch ms
 * @returns A staleness band
 */
export const stalenessOf = (lastSuccessAt: string | null, now: number): FeedStaleness => {
	if (!lastSuccessAt) return 'never'
	const then = Date.parse(lastSuccessAt)
	if (Number.isNaN(then)) return 'never'
	const age = now - then
	if (age >= FEED_STALE_PAGE_MS) return 'page'
	if (age >= FEED_STALE_ALERT_MS) return 'alert'
	if (age >= FEED_STALE_WARN_MS) return 'warn'
	return 'ok'
}

/**
 * Status snapshot for `/api/feed`.
 * @param state - Feed this process is serving
 * @param now - Current epoch ms
 * @returns Report safe to send to the browser. No feed body
 */
export const feedReport = (state: ArdFeedState, now = Date.now()): FeedReport => {
	const generatedAt = state.feed ? feedGeneratedAt(state.feed) : null
	const generated = generatedAt ? Date.parse(generatedAt) : Number.NaN
	return {
		at: new Date(now).toISOString(),
		source: state.source,
		revision: state.revision,
		generatedAt,
		itemCount: state.feed?.items.length ?? null,
		institutionCount: state.feed ? institutionIds(state.feed).size : null,
		ageMs: Number.isNaN(generated) ? null : Math.max(0, now - generated),
		lastSuccessAt: state.lastSuccessAt,
		lastAttemptAt: state.lastAttemptAt,
		lastError: state.lastError,
		staleness: stalenessOf(state.lastSuccessAt, now),
		outcome: state.outcome,
	}
}

/**
 * Replace the serving feed.
 * @param state - Process state
 * @param feed - Accepted document
 * @param revision - JetStream sequence, or null for a local file
 * @param source - Where it was read from
 */
const applyFeed = (state: ArdFeedState, feed: ArdFeed, revision: number | null, source: FeedSource): void => {
	state.feed = feed
	state.revision = revision
	state.source = source
}

/**
 * Take a KV revision if it passes the absolute rules and is not older than the one already serving.
 * A bad payload leaves the previous feed in place.
 * @param state - Process state
 * @param snapshot - Revision from the bucket
 * @returns True when the serving feed changed
 */
export const applyKvSnapshot = (state: ArdFeedState, snapshot: FeedSnapshot): boolean => {
	if (getArdFeedValidationError(snapshot.feed)) return false
	if (state.revision !== null && snapshot.revision <= state.revision) return false
	applyFeed(state, snapshot.feed, snapshot.revision, 'kv')
	return true
}

/**
 * Read a JSON feed file. Missing, unreadable, or invalid files return null.
 * @param path - Filesystem path
 * @returns The feed, or null
 */
const readFeedFile = async (path: string): Promise<ArdFeed | null> => {
	try {
		const text = await readFile(path, 'utf8')
		const parsed: unknown = JSON.parse(text)
		if (getArdFeedValidationError(parsed)) return null
		return parsed as ArdFeed
	} catch {
		return null
	}
}

/**
 * Read the gzip bootstrap copy.
 * @param path - Path to `ard-feed.json.gz`
 * @returns The feed, or null when the file is missing or invalid
 */
export const readBootstrapFile = async (path: string): Promise<ArdFeed | null> => {
	try {
		const bytes = gunzipSync(await readFile(path))
		const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
		if (getArdFeedValidationError(parsed)) return null
		return parsed as ArdFeed
	} catch {
		return null
	}
}

/**
 * Atomically replace a JSON file with the feed.
 * @param path - Destination
 * @param feed - Accepted document
 */
export const writeFeedFile = async (path: string, feed: ArdFeed): Promise<void> => {
	await mkdir(dirname(path), { recursive: true })
	const tmp = `${path}.tmp`
	await writeFile(tmp, JSON.stringify(feed))
	await rename(tmp, path)
}

/**
 * Load KV, then disk, then the bootstrap copy. The first valid document wins.
 * @param state - Process state to fill
 * @param sources - Where to look
 */
export const hydrateArdFeed = async (
	state: ArdFeedState,
	sources: {
		readKv: () => Promise<FeedSnapshot | null>
		diskPath: string
		bootstrapPath: string
	}
): Promise<void> => {
	try {
		const kv = await sources.readKv()
		if (kv) {
			applyFeed(state, kv.feed, kv.revision, 'kv')
			return
		}
	} catch {
		// KV unread. Disk and the bootstrap copy still count.
	}
	const disk = await readFeedFile(sources.diskPath)
	if (disk) {
		applyFeed(state, disk, null, 'disk')
		return
	}
	const bootstrap = await readBootstrapFile(sources.bootstrapPath)
	if (bootstrap) applyFeed(state, bootstrap, null, 'bootstrap')
}
