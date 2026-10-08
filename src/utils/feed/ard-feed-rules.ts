import type { ArdFeed, ArdLivestream } from '#types'

/**
 * Feed integrity rules. Tests stub fields (e.g. `minItems`) instead of building 190+ fixtures.
 */
export const ardFeedRules = {
	minItems: 190,
	maxItems: 251,
	stations: ['WDR 2', 'WDR 4', '1LIVE', 'NDR 1 Niedersachsen', 'SWR3', 'NDR 2', 'BAYERN 1', 'SWR4 BW', 'hr3', 'hr4'],
}

/**
 * Return a validation error message for an ARD feed payload, or `null` when valid.
 * @param feed - Parsed feed candidate
 * @returns Error message, or `null` if the feed passes integrity checks
 */
export const getArdFeedValidationError = (feed: unknown): string | null => {
	if (!(feed && typeof feed === 'object' && 'items' in feed && Array.isArray((feed as ArdFeed).items))) {
		return 'Feed is not an array'
	}

	const typed = feed as ArdFeed
	const feedItemCount = typed.items.length
	if (!feedItemCount) return 'Feed is empty'

	if (feedItemCount < ardFeedRules.minItems) {
		return `pageItemCount is too small > ${feedItemCount}`
	}

	if (feedItemCount >= ardFeedRules.maxItems) {
		return `pageItemCount is too high > ${feedItemCount}`
	}

	if (typed.totalPageCount > 1) {
		return 'Pagination is not supported'
	}

	for (const station of ardFeedRules.stations) {
		const isStationInFeed = typed.items.some((entry: ArdLivestream) => entry.publisher.title === station)
		if (!isStationInFeed) {
			return `🚨 ${station} not found in ARD feed!`
		}
	}

	return null
}
