import logger from '@frytg/logger'
import config from '#config'
import type {
	EventhubPluginMessage,
	EventhubService,
	LiveRadioEvent,
	LiveradioCredential,
	PermittedExcludedFields,
} from '#types'
import dts from '../../../config/dts-keys.ts'
import undici from '../../undici/index.ts'

const source = 'utils/plugins/dts/event'

const DEFAULT_HEADERS = {
	Accept: 'application/json',
	'Content-Type': 'application/json',
}
const LIVERADIO_URL = dts.endpoints.liveRadioEvent[config.stage as keyof typeof dts.endpoints.liveRadioEvent]

// provide remapping helpers
const getCoreIds = (services: EventhubService[]) =>
	services.flatMap((service) => (service.topic?.id ? [service.topic.id] : []))

const getUserForInstitution = (institutionId: string) => {
	// get user or reject if not found
	const liveradioUser = dts.credentials.liveradio.find((user: LiveradioCredential) => user.coreId === institutionId)
	if (!liveradioUser) return { token: null, username: null }

	// encode token
	const liveradioLogin = `${liveradioUser?.username}:${liveradioUser?.password}`
	return {
		token: `Basic ${Buffer.from(liveradioLogin, 'utf8').toString('base64')}`,
		username: liveradioUser.username,
	}
}

export default async (job: EventhubPluginMessage) => {
	// remap input
	const { event, plugin, institutionId } = job

	// only process now playing events
	if (event.name !== 'de.ard.eventhub.v1.radio.track.playing') {
		logger.warning({
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
	const liveRadioEvent: LiveRadioEvent = {
		broadcastId: null as string | null,
		contentId: null as string | null,

		type,
		status: 'playing' as string | null,

		client: config.serviceName as string | null,
		clientVersion: config.version as string | null,

		timestamp: event.start,
		artist: event.artist,
		title: event.title,
		isrc: event.isrc,
		email: plugin?.email || null,
		duration: event.length || null,

		delay: plugin?.delay || 0,
		album: plugin?.album || null,
		composer: plugin?.composer || null,
		program: plugin?.program || null,
		subject: plugin?.subject || null,
		webURL: plugin?.webUrl || null,
		enableShare: Boolean(plugin?.webUrl),

		enableThumbs:
			plugin?.enableThumbs === true || plugin?.enableThumbs === false ? plugin.enableThumbs : (true as boolean | null),
		year: null,
		fccId: null,
		imageURL: null as string | null,
	}

	// set thumbnail
	const mediaType = plugin?.preferArtistMedia ? 'artist' : 'cover'
	const media = event.media?.find((thisMedia) => thisMedia.type === mediaType)
	if (media?.url || media?.templateUrl) {
		liveRadioEvent.imageURL =
			media.url || media.templateUrl?.replace('{width}', '512').replace('{height}', '512') || null
	}

	// handle exclusions
	if (Array.isArray(plugin.excludeFields) && plugin.excludeFields.length > 0) {
		for (const field of plugin.excludeFields) {
			const permittedExcludedField = dts.permittedExcludedFields[field] as keyof LiveRadioEvent
			if (permittedExcludedField) {
				liveRadioEvent[permittedExcludedField] = null
			}
		}
	}

	// set event host and auth
	const { token: liveradioToken, username } = getUserForInstitution(institutionId)
	if (!(LIVERADIO_URL && liveradioToken)) {
		logger.log({
			level: 'error',
			message: 'failed loading DTS user for liveradio API',
			source,
			data: { job, ids: { coreIds } },
		})
		return Promise.resolve()
	}

	// insert coreId into events
	const liveRadioEvents = coreIds.map((coreId: string) => {
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
	if (posted.string.indexOf('error') !== -1) isDtsResponseOk = false
	if (posted.string.indexOf('dropped bids') !== -1) isDtsResponseOk = false
	if (posted.string.indexOf('not authorized') !== -1) isDtsResponseOk = false

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
