import logger from '@frytg/logger'
import { defaultHeaders, version } from '#config'
import { dtsKeys, serviceName, stage } from '#env'
import type {
	EventhubPluginMessage,
	EventhubService,
	LiveRadioEvent,
	LiveradioCredential,
	PermittedExcludedFields,
} from '#types'

const source = 'utils/plugins/dts/event'

const DEFAULT_HEADERS: RequestInit['headers'] = {
	...defaultHeaders,
	Accept: 'application/json',
	'Content-Type': 'application/json',
}
const LIVERADIO_URL = dtsKeys.endpoints.liveRadioEvent[stage as keyof typeof dtsKeys.endpoints.liveRadioEvent]

// provide remapping helpers
const getCoreIds = (services: EventhubService[]) =>
	services.flatMap((service) => (service.topic?.id ? [service.topic.id] : []))

const getUserForInstitution = (institutionId: string) => {
	// get user or reject if not found
	const liveradioUser = dtsKeys.credentials.liveradio.find((user: LiveradioCredential) => user.coreId === institutionId)
	if (!liveradioUser) return { token: null, username: null }

	// encode token
	const liveradioLogin = `${liveradioUser?.username}:${liveradioUser?.password}`
	return {
		token: `Basic ${Buffer.from(liveradioLogin, 'utf8').toString('base64')}`,
		username: liveradioUser.username,
	}
}

export default async (job: EventhubPluginMessage): Promise<void> => {
	const { event, plugin, institutionId } = job

	// only process now playing events
	if (event.name !== 'de.ard.eventhub.v1.radio.track.playing') {
		logger.warning({
			message: `DTS skipping event (not playing) > ${event.name}`,
			source,
			data: { job },
		})
		return
	}

	// collect ARD Core ids
	const coreIds = getCoreIds(event.services)

	// remap playing type
	let type = 'other'
	if (event.type === 'music') type = event.type
	if (event.type === 'advertisement') type = 'ad'

	// remap Eventhub variables to external ones
	const liveRadioEvent: LiveRadioEvent = {
		broadcastId: null,
		contentId: null,

		type,
		status: 'playing',

		client: serviceName,
		clientVersion: version,

		timestamp: event.start,
		artist: event.artist,
		title: event.title,
		isrc: event.isrc,
		email: plugin?.email || null,
		duration: event.length || null,

		delay: plugin?.delay ?? 0,
		album: plugin?.album || null,
		composer: plugin?.composer || null,
		program: plugin?.program || null,
		subject: plugin?.subject || null,
		webURL: plugin?.webUrl || null,
		enableShare: Boolean(plugin?.webUrl),

		enableThumbs: plugin?.enableThumbs ?? true,
		year: null,
		fccId: null,
		imageURL: null,
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
			const permittedExcludedField = dtsKeys.permittedExcludedFields[
				field as keyof PermittedExcludedFields
			] as keyof LiveRadioEvent
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
		return
	}

	// insert coreId into events
	const liveRadioEvents = coreIds.map((coreId: string) => {
		return { ...liveRadioEvent, publisherSourceId: coreId }
	})

	// post event
	const liveradioConfig: RequestInit = {
		method: 'POST',
		body: JSON.stringify(liveRadioEvents),
		signal: AbortSignal.timeout(10e3),
		headers: { ...DEFAULT_HEADERS, Authorization: liveradioToken },
	}
	let response: Response | undefined
	let text: string
	try {
		// During a timeout or when the network fails, fetch will throw an error
		response = await globalThis.fetch(LIVERADIO_URL, liveradioConfig)
		text = await response.text()
	} catch (error) {
		text = `network error or timeout: ${error}`
	}

	// check response for possible error keywords
	const isDtsResponseOk = !['error', 'dropped bids', 'not authorized'].some((err) => text.includes(err))

	// log result
	const message = [
		`DTS event done (${event.services[0]?.publisherId})`,
		`status ${response?.status}`,
		`${coreIds.length}x Core IDs`,
	]
	let json: object | undefined
	try {
		// the json parsing can fail silently, since we then re-use the text.
		json = JSON.parse(text)
	} catch {}
	logger.log({
		level: isDtsResponseOk && response?.ok ? 'info' : 'error',
		message: message.join(' > '),
		source,
		data: {
			input: job,
			coreIds,
			dts: {
				username,
				statusCode: response?.status,
				response: json ?? text,
				liveRadioEvent,
			},
		},
	})
}
