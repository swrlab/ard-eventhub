import type { ArdFeed, ArdLivestream, LivestreamOwner } from '#types'
import { feedState } from './current-feed.ts'

/**
 * Serve a minimal feed listing these livestream owners, for tests. Production writes go through `applyKvSnapshot`,
 * which rejects a feed this small.
 * @param owners - Livestream URN to publisher and institution
 * @returns Restores the feed that was served before
 */
export const serveTestFeed = (owners: Record<string, LivestreamOwner>): (() => void) => {
	const previous = feedState.feed
	const items = Object.entries(owners).map(
		([externalId, owner]) =>
			({
				id: `urn:ard:permanent-livestream-fusion:${externalId.slice(-6)}`,
				externalId,
				title: externalId,
				publisher: {
					id: owner.publisherId,
					title: owner.publisherId,
					institution: { id: owner.institutionId, title: owner.institutionId },
				},
			}) as ArdLivestream
	)
	feedState.feed = { items } as ArdFeed
	return () => {
		feedState.feed = previous
	}
}
