/*

	ard-eventhub
	by SWR Audio Lab

*/

// load node utils
const { isIncluded, notEmptyArray } = require('@swrlab/utils/packages/strings')

// load utils
const logger = require('../../logger')
const undici = require('../../undici')

// load keys
const { credentials, endpoints, permittedExcludedFields } = require('../../../../config/dts-keys')

// load config
const config = require('../../../../config')

const source = 'utils/plugins/dts/event'

const DEFAULT_HEADERS = { Accept: 'application/json', 'Content-Type': 'application/json' }
const LIVERADIO_URL = endpoints.liveRadioEvent[config.stage]

// provide remapping helpers
const getCoreIds = (services) => services.map((service) => service.topic.id)

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
			message: `DTS skipping event (not playing) > ${event.name}`,
			source,
			data: { job },
		})
		return Promise.resolve()
	}

	// collect ARD Core ids
	const coreIds = getCoreIds(event.services)

	// remap playing type
	let type = 'other'
	if (event.type === 'music') type = event.type
	if (event.type === 'advertisement') type = 'ad'

	// remap Eventhub variables to external ones
	const liveRadioEvent = {
		broadcastId: null,
		contentId: null,

		type,
		status: 'playing',

		client: config.serviceName,
		clientVersion: config.version,

		timestamp: event.start,
		artist: event.artist,
		title: event.title,
		isrc: event.isrc,
		email: plugin?.email,
		duration: Number.parseInt(event.length),

		delay: plugin?.delay || 0,
		album: plugin?.album || null,
		composer: plugin?.composer || null,
		program: plugin?.program || null,
		subject: plugin?.subject || null,
		webURL: plugin?.webUrl || null,
		enableShare: !!plugin?.webUrl,

		enableThumbs: plugin?.enableThumbs === true || plugin?.enableThumbs === false ? plugin.enableThumbs : true,
		year: null,
		fccId: null,
		imageURL: null,
	}

	// set thumbnail
	const mediaType = plugin?.preferArtistMedia ? 'artist' : 'cover'
	const media = event.media?.find((thisMedia) => thisMedia.type === mediaType)
	if (media) {
		liveRadioEvent.imageURL = media.url || media.templateUrl.replace('{width}', 512).replace('{height}', 512)
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
			message: 'failed loading DTS user for liveradio API',
			source,
			data: { job, ids: { coreIds } },
		})
		return Promise.resolve()
	}

	// insert coreId into events
	const liveRadioEvents = coreIds.map((coreId) => {
		return { ...liveRadioEvent, publisherSourceId: coreId }
	})

	// post event
	const liveradioConfig = {
		method: 'POST',
		body: JSON.stringify(liveRadioEvents),
		timeout: 7e3,
		reject: false,
		headers: { ...DEFAULT_HEADERS, Authorization: liveradioToken },
	}
	const posted = await undici(LIVERADIO_URL, liveradioConfig)

	// check response for keywords
	let isDtsResponseOk = true
	if (isIncluded(posted.string, 'error')) isDtsResponseOk = false
	if (isIncluded(posted.string, 'dropped bids')) isDtsResponseOk = false
	if (isIncluded(posted.string, 'not authorized')) isDtsResponseOk = false

	// log result
	const message = [
		`DTS event done (${event.services[0]?.publisherId})`,
		`status ${posted.statusCode}`,
		`${coreIds.length}x Core IDs`,
	]
	logger.log({
		level: isDtsResponseOk && posted.ok ? 'info' : 'error',
		message: message.join(' > '),
		source,
		data: {
			input: job,
			coreIds,
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
