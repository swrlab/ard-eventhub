import type { ArdFeed, KnownLivestream } from '#types'
import { knownLivestreams, livestreamOverlayNote } from '../../utils/feed/known-livestreams.ts'

/**
 * Rows for the feed board. The list itself is `knownLivestreams`.
 * @param feed - Snapshot this process is serving, or null
 * @returns Overlay note and the combined rows
 */
export const buildFeedCatalog = (feed: ArdFeed | null): { note: string; entries: KnownLivestream[] } => ({
	note: livestreamOverlayNote,
	entries: knownLivestreams(feed),
})
