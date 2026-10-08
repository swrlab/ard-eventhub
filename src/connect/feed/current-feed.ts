import type { ArdFeed, FeedReport, LivestreamOwner } from '#types'
import { livestreamOwners } from '../../utils/feed/known-livestreams.ts'
import { createArdFeedState, feedReport } from './ard-feed.ts'

/**
 * The feed this process serves. Reads are synchronous and do no I/O.
 * Only `ard-feed-loader.ts` writes it, and only through `applyKvSnapshot`, so every value came from KV.
 */
export const feedState = createArdFeedState()

/**
 * Latest KV revision of the ARD feed.
 * @returns The feed, or null before the first revision arrived
 */
export const currentFeed = (): ArdFeed | null => feedState.feed

/**
 * Livestream URN to publisher and institution, for the ownership check. Rebuilt once per revision.
 * @returns Owners, or null before the first revision arrived
 */
export const currentOwners = (): ReadonlyMap<string, LivestreamOwner> | null => livestreamOwners(feedState.feed)

/**
 * Status of the serving feed for `/api/feed`.
 * @param now - Current epoch ms
 * @returns Report without the feed body
 */
export const currentFeedReport = (now = Date.now()): FeedReport => feedReport(feedState, now)
