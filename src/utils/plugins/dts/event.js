/*

	ard-eventhub
	by SWR Audio Lab

*/

// load node utils
const { isIncluded, notEmptyArray } = require('@swrlab/utils/packages/strings')

// load utils
const logger = require('../../logger')
const undici = require('../../undici')

// load config
const config = require('../../../../config')

// load keys
const dtsKeys = require('../../../../config/dtsKeys')

const { credentials, endpoints, integrationName, permittedExcludedFields } = dtsKeys

const source = 'utils/plugins/dts/event'

const DEFAULT_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' }
const LIVERADIO_URL = endpoints.liveRadioEvent[config.stage]
const RECORDS_INTEGRATION_URL = endpoints.listIntegrationRecords.replace('{integrationName}', integrationName)
const DASHBOARD_REQUEST_CONFIG = {
	timeout: 7e3,
	reject: false,
	headers: { ...DEFAULT_HEADERS, Authorization: credentials.dashboardToken },
}

// provide remapping helpers
const getCoreIds = (services) => services.map((service) => service.topic.id)
const filterIntegrations = (li, coreIds) =>
	li.filter((i) => i.external_system === integrationName && coreIds.includes(i.external_id))
const getContentIds = (li) => li.map((integration) => integration.content_id)

const getUserForInstitution = (institutionId) => {
	// get user or reject if not found
	const liveradioUser = credentials.liveradio.find((user) => user.coreId === institutionId)
	if (!liveradioUser) return { token: null, username: null }

	// encode token
	const liveradioLogin = `${liveradioUser?.username}:${liveradioUser?.password}`
	return {
		token: `Basic ${Buffer.from(liveradioLogin, 'utf8').toString('base64')}`,
		username: liveradioUser.username,
	}
}

module.exports = async (job) => {
	// remap input
	const { event, plugin, institutionId } = job

	// only process now playing events
	if (event.name !== 'de.ard.eventhub.v1.radio.track.playing') {
		logger.log({
			level: 'debug',
			message: `DTS skipping event != playing > ${event.name}`,
			source,
			data: { job },
		})
		return Promise.resolve()
	}

	// collect ARD Core IDs
	const coreIds = getCoreIds(event.services)

	// fetch all externally mapped ids
	const integrationsList = await undici(RECORDS_INTEGRATION_URL, DASHBOARD_REQUEST_CONFIG)

	// end processing if no integrations were found
	if (!integrationsList.ok || !notEmptyArray(integrationsList.json)) {
		logger.log({
			level: 'error',
			message: `failed loading DTS integrations`,
			source,
			data: { job, ids: { coreIds }, string: integrationsList.string, json: integrationsList.json },
		})
		return Promise.resolve()
	}

	// filter integrations matching these ARD Core IDs
	const matchingIntegrations = filterIntegrations(integrationsList.json, coreIds)
	const contentIds = getContentIds(matchingIntegrations)

	// catch non-existent mappings
	if (!notEmptyArray(contentIds)) {
		logger.log({
			level: 'notice',
			message: `DTS BID mapping missing for coreIds`,
			source,
			data: { job, ids: { coreIds } },
		})
		return Promise.resolve()
	}

	// fetch all matching broadcasts
	const searchBroadcastsUrl = endpoints.searchBroadcasts.replace('{contentQuery}', contentIds.join(','))
	const broadcasts = await undici(searchBroadcastsUrl, DASHBOARD_REQUEST_CONFIG)

	// end processing if no broadcasts were found
	if (!broadcasts.ok || !notEmptyArray(broadcasts.json)) {
		logger.log({
			level: 'error',
			message: `failed loading DTS broadcasts for coreIds`,
			source,
			data: { job, ids: { coreIds, contentIds }, string: broadcasts.string, json: broadcasts.json },
		})
		return Promise.resolve()
	}

	// remap broadcast IDs
	const linkedBroadcastIds = broadcasts.json.map((broadcast) => broadcast.broadcast_id)

	// remap playing type
	let type = 'other'
	if (event.type === 'music') type = event.type
	if (event.type === 'advertisement') type = 'ad'

	// remap Eventhub variables to external ones
	const liveRadioEvent = {
		broadcastId: null,
		linkedBroadcastIds,

		type,
		status: 'playing',

		client: config.serviceName,
		clientVersion: config.version,

		timestamp: event.start,
		artist: event.artist,
		title: event.title,
		isrc: event.isrc,
		email: plugin?.email,
		duration: parseInt(event.length),

		delay: plugin?.delay || 0,
		album: plugin?.album || null,
		composer: plugin?.composer || null,
		program: plugin?.program || null,
		subject: plugin?.subject || null,
		webURL: plugin?.webUrl || null,
		enableShare: !!plugin?.webUrl,

		enableThumbs:
			plugin?.enableThumbs === true || plugin?.enableThumbs === false ? plugin.enableThumbs : true,
		year: null,
		fccId: null,
		imageURL: null,
	}

	// set thumbnail
	const mediaType = plugin?.preferArtistMedia ? 'artist' : 'cover'
	const media = event.media?.find((thisMedia) => thisMedia.type === mediaType)
	if (media) {
		liveRadioEvent.imageURL =
			media.url || media.templateUrl.replace('{width}', 512).replace('{height}', 512)
	}

	// handle exclusions
	if (notEmptyArray(plugin.excludeFields)) {
		for (const field of plugin.excludeFields) {
			if (permittedExcludedFields[field]) {
				liveRadioEvent[permittedExcludedFields[field]] = null
			}
		}
	}

	// set event host and auth
	const { token: liveradioToken, username } = getUserForInstitution(institutionId)
	if (!LIVERADIO_URL || !liveradioToken) {
		logger.log({
			level: 'error',
			message: `failed loading DTS user for liveradio API`,
			source,
			data: { job, ids: { coreIds } },
		})
		return Promise.resolve()
	}

	// post event
	const liveradioConfig = {
		method: 'POST',
		body: JSON.stringify([liveRadioEvent]),
		timeout: 7e3,
		reject: false,
		headers: { ...DEFAULT_HEADERS, Authorization: liveradioToken },
	}
	const posted = await undici(LIVERADIO_URL, liveradioConfig)

	// check response for keywords
	let isDtsResponseOkay = true
	if (isIncluded(posted.string, 'dropped bids')) isDtsResponseOkay = false
	if (isIncluded(posted.string, 'not authorized')) isDtsResponseOkay = false

	// log result
	const message = [
		`DTS event done (${event.services[0]?.publisherId})`,
		`status ${posted.statusCode}`,
		`${linkedBroadcastIds?.length}x BIDs`,
		`${contentIds?.length}x contentIds ${JSON.stringify(contentIds)}`,
		`${coreIds.length}x Core IDs`,
	]
	logger.log({
		level: isDtsResponseOkay && posted.ok ? 'info' : 'error',
		message: message.join(' > '),
		source,
		data: {
			input: job,
			ids: { coreIds, contentIds, linkedBroadcastIds },
			dts: {
				username,
				statusCode: posted.statusCode,
				response: posted.json || posted.string,
				liveRadioEvent,
			},
		},
	})

	return Promise.resolve()
}
