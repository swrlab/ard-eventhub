/* eslint-disable no-nested-ternary */
/*

	ard-eventhub
	by SWR audio lab

*/

// load utils
const logger = require('../../logger')
const secrets = require('../../secrets')
const undici = require('../../undici')

// load config
const config = require('../../../../config')

const source = 'utils/plugins/dts/event'

const defaultHeaders = { Accept: 'application/json' }

const checkIfArrayHasContent = (thisArray) => {
	return Array.isArray(thisArray) && thisArray.length > 0
}

module.exports = async (job) => {
	// remap input
	const { event, messageId, plugin } = job

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

	// fetch secrets config
	const { json: pluginSecrets } = await secrets.get(`plugins-dts-${config.stage}`)
	const { credentials, endpoints, integrationName, permittedExcludedFields } = pluginSecrets

	// collect ARD Core ids
	const coreIds = event.services.map((service) => service?.topic?.id)

	// fetch all externally mapped ids
	const lookupConfig = {
		url: endpoints.listIntegrationRecords.replace('{integrationName}', integrationName),
		method: 'GET',
		timeout: 7e3,
		headers: {
			...defaultHeaders,
			Authorization: credentials.dashboard,
		},
	}
	const integrationsList = await undici(lookupConfig.url, lookupConfig)

	// end processing if no integrations were found
	if (!integrationsList.ok) {
		logger.log({
			level: 'error',
			message: `failed loading DTS integrations (err 1)`,
			source,
			data: { messageId, job, coreIds, response: integrationsList.string },
		})
		return Promise.resolve()
	}

	// end processing if no integrations were found
	if (!checkIfArrayHasContent(integrationsList.json)) {
		logger.log({
			level: 'error',
			message: `failed loading DTS integrations (err 2)`,
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
	if (!checkIfArrayHasContent(contentIds)) {
		logger.log({
			level: 'notice',
			message: `DTS BID mapping missing for coreIds (err 3)`,
			source,
			data: { messageId, job, coreIds },
		})
		return Promise.resolve()
	}

	// fetch all matching broadcasts
	lookupConfig.url = endpoints.searchBroadcasts.replace('{contentQuery}', contentIds.join(','))
	const broadcasts = await undici(lookupConfig.url, lookupConfig)

	// end processing if no integrations were found
	if (!broadcasts.ok) {
		logger.log({
			level: 'error',
			message: `failed loading DTS broadcasts for coreIds (err 4)`,
			source,
			data: { messageId, job, coreIds, response: broadcasts.string },
		})
		return Promise.resolve()
	}

	// end processing if no broadcasts were found
	if (!checkIfArrayHasContent(broadcasts.json)) {
		logger.log({
			level: 'notice',
			message: `failed finding DTS broadcasts for coreIds (err 5)`,
			source,
			data: { messageId, job, coreIds, contentIds, response: broadcasts.json },
		})
		return Promise.resolve()
	}

	// remap broadcast IDs
	const linkedBroadcastIds = broadcasts.json.map((broadcast) => broadcast.broadcast_id)

	// remap Eventhub variables to external ones
	const liveRadioEvent = {
		broadcastId: null,
		linkedBroadcastIds,

		type: event.type === 'music' ? event.type : event.type === 'advertisement' ? 'ad' : 'other',
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
	if (checkIfArrayHasContent(plugin.excludeFields)) {
		for (const field of plugin.excludeFields) {
			if (permittedExcludedFields[field]) {
				liveRadioEvent[permittedExcludedFields[field]] = null
			}
		}
	}

	// post event
	const postConfig = {
		url: endpoints.liveRadioEvent[config.stage],
		method: 'POST',
		body: JSON.stringify([liveRadioEvent]),
		timeout: 7e3,
		headers: {
			...defaultHeaders,
			Authorization: credentials.liveradio,
			'Content-Type': 'application/json',
		},
	}
	const posted = await undici(postConfig.url, postConfig)

	// log result
	logger.log({
		level: posted.ok ? 'info' : 'error',
		message: `DTS event done > status ${posted.statusCode} > contentIds ${contentIds.join(',')}`,
		source,
		data: {
			messageId,
			input: job,
			ids: { coreIds, contentIds, linkedBroadcastIds },
			posted: { statusCode: posted.statusCode, response: posted.string, liveRadioEvent },
		},
	})

	return Promise.resolve()
}
