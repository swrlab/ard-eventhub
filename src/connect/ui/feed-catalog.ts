import type { ArdFeed } from '#types'
import type { KnownLivestream } from '../../utils/known-livestreams.ts'
import type { FeedReport } from '../ard-feed.ts'
import { knownLivestreams, livestreamOverlayNote } from '../../utils/known-livestreams.ts'

/** Serving feed plus the overlay rows. */
export type FeedCatalogReport = FeedReport & {
	note: string
	entries: KnownLivestream[]
}

/**
 * Rows for the feed board. The list itself is `knownLivestreams`.
 * @param feed - Snapshot this process is serving, or null
 * @returns Overlay note and the combined rows
 */
export const buildFeedCatalog = (feed: ArdFeed | null): { note: string; entries: KnownLivestream[] } => ({
	note: livestreamOverlayNote,
	entries: knownLivestreams(feed),
})
