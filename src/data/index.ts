import fs from 'node:fs'
import { exitWithError } from '@frytg/check-required-env/exit'
import { getRequiredEnv } from '@frytg/check-required-env/get'
import { getMs, getMsOffset } from '@frytg/dates'
import logger from '@frytg/logger'
import { fetch } from 'undici'

getMsOffset(getMs())

import type { ArdFeed, ArdLivestream } from '@/types.ard'

const ARD_FEED_URL = getRequiredEnv('ARD_FEED_URL')
const DOWNLOAD_TO_FILE = false
const MIN_FEED_PAGE_ITEMS = 251
const MIN_FEED_ITEMS = 190
const MAX_FEED_ITEMS = 251
const STATIONS = [
	'WDR 2',
	'WDR 4',
	'1LIVE',
	'NDR 1 Niedersachsen',
	'SWR3',
	'NDR 2',
	'BAYERN 1',
	'SWR4 BW',
	'hr3',
	'hr4',
]
const START_TIME = getMs()
const source = 'data'

/**
 * The ARD feed is downloaded and cached in this variable. This is used to avoid multiple downloads of the feed.
 */
export let ardFeed: ArdFeed | null = null

export const getARDFeed = async () => {
	try {
		// download ard feed
		const res = await fetch(ARD_FEED_URL, { signal: AbortSignal.timeout(10e3) })

		// check api
		if (!res.ok || res.status !== 200) return exitWithError(`API is not available (${res.status})`)

		// parse reponse
		const feed: ArdFeed = (await res.json()) as ArdFeed
		if (!feed?.items || !Array.isArray(feed.items)) return exitWithError('Feed is not an array')

		// check integrity of feed length
		const feedItemCount = feed.items.length
		if (!feedItemCount) return exitWithError('Feed is empty')

		// check if feed has enough items
		if (feed.pageItemCount < MIN_FEED_PAGE_ITEMS) {
			const message = `pageItemCount is too small for the ARD Feed with its expected amount of stations: ${feed.pageItemCount}`

			logger.log({
				level: 'error',
				message: message,
				source,
			})

			return exitWithError(`pageItemCount is too small > ${feed.pageItemCount}`)
		}

		// check if feed has enough items
		if (feedItemCount < MIN_FEED_ITEMS) {
			const message = `ARD Feed contains an unexpected amount of stations: ${feedItemCount}`
			logger.log({
				level: 'error',
				message: message,
				source,
			})

			return exitWithError(`pageItemCount is too small > ${feedItemCount}`)
		}

		// check if feed has too many items
		if (feedItemCount >= MAX_FEED_ITEMS) {
			const message = `ARD Feed contains an unexpected amount of stations: ${feedItemCount}`
			logger.log({
				level: 'error',
				message: message,
				source,
			})

			return exitWithError(`pageItemCount is too high > ${feedItemCount}`)
		}

		// check for pagination
		if (feed.totalPageCount > 1) return exitWithError('Pagination is not supported')

		// check if any expected Station is missing
		for (const station of STATIONS) {
			const isStationInFeed = feed.items.some((entry: ArdLivestream) => entry.publisher.title === station)

			if (!isStationInFeed) {
				return exitWithError(`🚨 ${station} not found in ARD feed!`)
			}
		}

		// save to local storage
		if (DOWNLOAD_TO_FILE) {
			fs.writeFileSync(`${__dirname}/../data/ard-core-livestreams.json`, JSON.stringify(feed, null, '\t'))
		}

		logger.log({
			level: 'info',
			message: `ARD feed downloaded successfully > ${getMsOffset(START_TIME)}ms`,
			source,
		})

		// save to global variable
		ardFeed = feed

		return feed
	} catch (error) {
		logger.log({
			level: 'error',
			message: `Failed to download ARD feed: ${error}`,
			source,
			error,
		})
		return exitWithError('Failed to download ARD feed')
	}
}
