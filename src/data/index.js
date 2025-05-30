// load utils
const undici = require('../utils/undici')
const fs = require('node:fs')
const logger = require('../utils/logger')

const ARD_FEED_URL = process.env.ARD_FEED_URL
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

const exitWithError = (message) => {
	logger.log({
		level: 'error',
		message: message,
		source: 'Livestream Data',
		error: Error(message),
		data: {},
	})

	process.exit(1)
}

const getARDFeed = async () => {
	// download ard feed
	const {
		statusCode,
		json: feed,
		ok,
	} = await undici(ARD_FEED_URL, {
		method: 'GET',
		timeout: 4e3,
	})

	// check api
	if (!ok || statusCode !== 200)
		return exitWithError(`API is not available (${statusCode})`)

	const feedItemCount = feed.items.length

	// check integrity
	if (!feed || !feed.items || !feedItemCount)
		return exitWithError('Feed is empty')

	// check if feed has enough items
	if (feed.pageItemCount < MIN_FEED_PAGE_ITEMS) {
		logger.log({
			level: 'error',
			message: `pageItemCount is too small for the ARD Feed with its expected amount of stations: ${feed.pageItemCount}`,
			source: 'Livestream Data',
			error: Error(message),
			data: {},
		})

		return exitWithError(
			`pageItemCount is too small > ${feed.pageItemCount}`
		)
	}

	// check if feed has enough items
	if (feedItemCount < MIN_FEED_ITEMS) {
		logger.log({
			level: 'error',
			message: `ARD Feed contains an unexpected amount of stations: ${feedItemCount}`,
			source: 'Livestream Data',
			error: Error(message),
			data: {},
		})

		return exitWithError(
			`pageItemCount is too small > ${feedItemCount}`
		)
	}

	// check if feed has too many items
	if (feedItemCount >= MAX_FEED_ITEMS) {
		logger.log({
			level: 'error',
			message: `ARD Feed contains an unexpected amount of stations: ${feedItemCount}`,
			source: 'Livestream Data',
			error: Error(message),
			data: {},
		})

		return exitWithError(
			`pageItemCount is too high > ${feedItemCount}`
		)
	}

	// check for pagination
	if (feed.totalPageCount > 1)
		return exitWithError('Pagination is not supported')

	// check if any expected Station is missing
	for (const station of STATIONS) {
		const isStationInFeed = feed.items.some(
			(entry) => entry.publisher.title === station
		)

		if (!isStationInFeed) {
			return exitWithError(
				`🚨 ${station} not found in ARD feed!`
			)
		}
	}

	// save to local storage
	fs.writeFileSync(
		`${__dirname}/../data/ard-core-livestreams.json`,
		JSON.stringify(feed, null, '\t')
	)
	logger.log({
		level: 'info',
		message: 'ARD feed downloaded successfully',
		source: 'Livestream Data',
		data: {},
	})

	return feed
}

// get initial feed
getARDFeed()

module.exports = getARDFeed
