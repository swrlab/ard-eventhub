import type {
	ArdFeed,
	ArdFeedState,
	FeedReport,
	FeedSnapshot,
	FeedStaleness,
	UpstreamDecision,
} from '#types'
import { getArdFeedValidationError } from '../../utils/feed/ard-feed-rules.ts'

/** JetStream stream that holds the feed. KV subjects live under `$KV.ARD_FEED.>`. */
export const ARD_FEED_STREAM = 'KV_ARD_FEED'

/** One document per revision. History is `max_msgs_per_subject` on the stream. */
export const ARD_FEED_SUBJECT = '$KV.ARD_FEED.livestreams'

/** Missed refreshes. `/api/update-feed` is triggered hourly. */
export const FEED_STALE_WARN_MS = 3 * 60 * 60 * 1000

/** Twelve missed refreshes. */
export const FEED_STALE_ALERT_MS = 12 * 60 * 60 * 1000

/** Two days without a valid fetch. */
export const FEED_STALE_PAGE_MS = 48 * 60 * 60 * 1000

/**
 * Empty state, before the first KV revision.
 * @returns A state with no feed
 */
export const createArdFeedState = (): ArdFeedState => ({
	feed: null,
	revision: null,
	lastSuccessAt: null,
	lastAttemptAt: null,
	lastError: null,
	outcome: null,
})

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
 * Take a KV revision if it passes the absolute rules and is newer than the one already serving.
 * The only writer of `state.feed`. A bad payload leaves the previous feed in place.
 * @param state - Process state
 * @param snapshot - Revision from the bucket
 * @returns True when the serving feed changed
 */
export const applyKvSnapshot = (state: ArdFeedState, snapshot: FeedSnapshot): boolean => {
	if (getArdFeedValidationError(snapshot.feed)) return false
	if (state.revision !== null && snapshot.revision <= state.revision) return false
	state.feed = snapshot.feed
	state.revision = snapshot.revision
	return true
}
