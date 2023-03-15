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

const defaultHeaders = { Accept: 'application/json', 'Content-Type': 'application/json' }

module.exports = async (job) => {
	// remap input
	const { event, messageId, plugin, institutionId } = job

	// only process now playing events
	if (event.name !== 'de.ard.eventhub.v1.radio.track.playing') {
		logger.log({
			level: 'debug',
			message: `DTS skipping event != playing > ${event.name}`,
			source,
			data: { messageId, job },
		})
		return Promise.resolve()
	}

	// collect ARD Core ids
	const coreIds = event.services.map((service) => service.topic.id)

	// set up dashboard API fetching
	const lookupConfig = {
		timeout: 7e3,
		reject: false,
		headers: { ...defaultHeaders, Authorization: credentials.dashboardToken },
	}

	// fetch all externally mapped ids
	const integrationsEndpointUrl = endpoints.listIntegrationRecords.replace('{integrationName}', integrationName)
	const integrationsList = await undici(integrationsEndpointUrl, lookupConfig)

	// end processing if no integrations were found
	if (!integrationsList.ok) {
		logger.log({
			level: 'error',
			message: `failed loading DTS integrations`,
			source,
			data: { messageId, job, coreIds, response: integrationsList.string },
		})
		return Promise.resolve()
	}

	// end processing if no integrations were found
	if (!notEmptyArray(integrationsList.json)) {
		logger.log({
			level: 'error',
			message: `failed loading DTS integrations`,
			source,
			data: { messageId, job, coreIds },
		})
		return Promise.resolve()
	}

	// filter IDs matching these services
	const contentIds = integrationsList.json
		.filter(
			(integration) =>
				integration.external_system === integrationName &&
				coreIds.includes(integration.external_id)
		)
		.map((integration) => integration.content_id)

	// catch non-existent mappings
	if (!notEmptyArray(contentIds)) {
		logger.log({
			level: 'notice',
			message: `DTS BID mapping missing for coreIds`,
			source,
			data: { messageId, job, coreIds },
		})
		return Promise.resolve()
	}

	// fetch all matching broadcasts
	const searchBroadcastsUrl = endpoints.searchBroadcasts.replace('{contentQuery}', contentIds.join(','))
	const broadcasts = await undici(searchBroadcastsUrl, lookupConfig)

	// end processing if no integrations were found
	if (!broadcasts.ok) {
		logger.log({
			level: 'error',
			message: `failed loading DTS broadcasts for coreIds`,
			source,
			data: { messageId, job, coreIds, response: broadcasts.string },
		})
		return Promise.resolve()
	}

	// end processing if no broadcasts were found
	if (!notEmptyArray(broadcasts.json)) {
		logger.log({
			level: 'notice',
			message: `failed finding DTS broadcasts for coreIds`,
			source,
			data: { messageId, job, coreIds, contentIds, response: broadcasts.json },
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
	const liveradioUrl = endpoints.liveRadioEvent[config.stage]
	const liveradioUser = credentials.liveradio.find((user) => user.coreId === institutionId)
	const liveradioLogin = `${liveradioUser?.username}:${liveradioUser?.password}`
	const liveradioToken = `Basic ${Buffer.from(liveradioLogin, 'utf8').toString('base64')}`
	if (!liveradioUrl || !liveradioUser || !liveradioLogin) {
		logger.log({
			level: 'error',
			message: `failed loading DTS user for liveradio API`,
			source,
			data: { messageId, job, coreIds },
		})
		return Promise.resolve()
	}

	// post event
	const postConfig = {
		method: 'POST',
		body: JSON.stringify([liveRadioEvent]),
		timeout: 7e3,
		reject: false,
		headers: { ...defaultHeaders, Authorization: liveradioToken },
	}
	const posted = await undici(liveradioUrl, postConfig)

	// check response for keywords
	let isDtsResponseOkay = true
	if (posted.json?.data?.length > 0) {
		for (const item of posted.json.data) {
			if (isIncluded(item, 'not authorized')) isDtsResponseOkay = false
		}
	}

	// log result
	logger.log({
		level: !isDtsResponseOkay || !posted.ok ? 'error' : 'info',
		message: `DTS event done > status ${posted.statusCode} > contentIds ${contentIds.join(',')}`,
		source,
		data: {
			messageId,
			posted: {
				statusCode: posted.statusCode,
				response: posted.json || posted.string,
				liveRadioEvent,
			},
			input: job,
			ids: { coreIds, contentIds, linkedBroadcastIds },
		},
	})

	return Promise.resolve()
}
