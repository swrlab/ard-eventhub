// load utils
const undici = require('../utils/undici')

const ARD_FEED_URL = process.env.ARD_FEED_URL
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
	console.error(message)
	process.exit(1)
}

const download = async () => {
	// download ard feed
	const response = await undici.fetch(ARD_FEED_URL)
	const feed = await response.json()

	// check api
	if (!response.ok || response.status !== 200)
		return exitWithError(
			`API is not available (${response.status})`
		)

	// check integrity
	if (!feed || !feed.items || !feed.items.length)
		return exitWithError('Feed is empty')

	// check if feed has enough items
	if (feed.pageItemCount < MIN_FEED_ITEMS) {
		console.log(
			`ARD Feed contains an unexpected amount of stations: ${feed.pageItemCount}`
		)

		return exitWithError(
			`pageItemCount is too small > ${feed.pageItemCount}`
		)
	}

	// check if feed has too many items
	if (feed.pageItemCount >= MAX_FEED_ITEMS) {
		console.log(
			`ARD Feed contains an unexpected amount of stations: ${feed.pageItemCount}`
		)

		return exitWithError(
			`pageItemCount is too high > ${feed.pageItemCount}`
		)
	}

	// check for pagination
	if (feed.totalPageCount > 1)
		return exitWithError('Pagination is not supported')

	// check if any expected Station is missing
	for (const station in STATIONS) {
		const isStationInFeed = feed.items.any(
			(entry) => entry.publisher.title === station
		)

		if (!isStationInFeed) {
			return exitWithError(
				`🚨 ${station} not found in ARD feed!`
			)
		}
	}

	// save to local storage
	await Bun.write(
		`${__dirname}/../data/ard-core-livestreams.json`,
		JSON.stringify(feed, null, '\t')
	)
	console.log('ARD feed downloaded successfully')
	return null
}

download()
