import type { ArdFeed, ArdLivestream } from '#types'
import fs from 'node:fs'
import process from 'node:process'
import { getMs, getMsOffset } from '@frytg/dates'
import logger from '@frytg/logger'
import { ardFeedUrl } from '#env'

const DOWNLOAD_TO_FILE = false
const START_TIME = getMs()
const source = 'utils.ard-feed.getARDFeed'

/**
 * Fatal ARD feed error. Thrown by {@link ardFeedClient.fail} so callers/tests can distinguish
 * intentional failures from unexpected exceptions (and so `catch` does not wrap them).
 */
export class ArdFeedError extends Error {
	/**
	 * @param message - Fatal error message
	 */
	constructor(message: string) {
		super(message)
		this.name = 'ArdFeedError'
	}
}

/**
 * Feed integrity rules. Tests stub fields (e.g. `minItems`) instead of building 190+ fixtures.
 */
export const ardFeedRules = {
	minItems: 190,
	maxItems: 251,
	stations: ['WDR 2', 'WDR 4', '1LIVE', 'NDR 1 Niedersachsen', 'SWR3', 'NDR 2', 'BAYERN 1', 'SWR4 BW', 'hr3', 'hr4'],
}

/**
 * Network / process side effects. Tests stub `fetch` and `fail` with sinon.
 */
export const ardFeedClient = {
	/**
	 * Fetch a URL (defaults to `globalThis.fetch`).
	 * @param url - Request URL
	 * @param init - Fetch init
	 * @returns Fetch response
	 */
	fetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
		return globalThis.fetch(url, init)
	},
	/**
	 * Abort with a fatal feed error (logs, exits the process, then throws for typing/tests).
	 * @param message - Error message
	 * @returns Never
	 */
	fail(message: string): never {
		logger.error({
			message,
			source: 'utils.ard-feed.fail',
		})
		process.exit(1)
		throw new ArdFeedError(message)
	},
}

/**
 * Cached ARD livestream feed. Populated by {@link getARDFeed}; used to avoid re-downloading.
 */
export let ardFeed: ArdFeed | null = null

/**
 * Clear the cached feed (used by tests).
 */
export const resetArdFeed = (): void => {
	ardFeed = null
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

/**
 * Download the ARD livestream feed, validate integrity, and cache it in {@link ardFeed}.
 * @returns The parsed feed
 */
export const getARDFeed = async (): Promise<ArdFeed> => {
	try {
		const res = await ardFeedClient.fetch(ardFeedUrl, {
			signal: AbortSignal.timeout(10e3),
		})

		if (res.status !== 200) return ardFeedClient.fail(`API is not available (${res.status})`)

		const feed = (await res.json()) as ArdFeed
		const validationError = getArdFeedValidationError(feed)
		if (validationError) {
			if (
				validationError.startsWith('pageItemCount is too small') ||
				validationError.startsWith('pageItemCount is too high') ||
				validationError === 'Pagination is not supported'
			) {
				logger.error({
					message:
						validationError === 'Pagination is not supported'
							? 'Pagination is not supported'
							: `unexpected station count in ARD feed > ${feed.items?.length}`,
					source,
				})
			}
			return ardFeedClient.fail(validationError)
		}

		if (DOWNLOAD_TO_FILE) {
			fs.writeFileSync(`${import.meta.dirname}/ard-core-livestreams.json`, JSON.stringify(feed, null, '\t'))
		}

		logger.info({
			message: `ard feed downloaded successfully > ${getMsOffset(START_TIME)}ms`,
			source,
		})

		ardFeed = feed
		return feed
	} catch (error) {
		if (error instanceof ArdFeedError) throw error
		logger.error({
			message: 'Failed to download ARD feed',
			source,
			error,
		})
		return ardFeedClient.fail('Failed to download ARD feed')
	}
}
