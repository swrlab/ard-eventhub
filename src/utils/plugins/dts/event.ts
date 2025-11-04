/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import { isIncluded, notEmptyArray } from '@swrlab/utils/packages/strings'

import config from '../../../../config'
import dts from '../../../../config/dts-keys'
import undici from '../../undici'

const source = 'utils/plugins/dts/event'

const DEFAULT_HEADERS = {
	Accept: 'application/json',
	'Content-Type': 'application/json',
}
const LIVERADIO_URL = dts.endpoints.liveRadioEvent[config.stage as keyof typeof dts.endpoints.liveRadioEvent]

// provide remapping helpers
const getCoreIds = (services: any) => services.map((service: any) => service.topic.id)

const getUserForInstitution = (institutionId: string) => {
	// get user or reject if not found
	const liveradioUser = dts.credentials.liveradio.find((user: any) => user.coreId === institutionId)
	if (!liveradioUser) return { token: null, username: null }

	// encode token
	const liveradioLogin = `${liveradioUser?.username}:${liveradioUser?.password}`
	return {
		token: `Basic ${Buffer.from(liveradioLogin, 'utf8').toString('base64')}`,
		username: liveradioUser.username,
	}
}

export default async (job: any) => {
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
		broadcastId: null as string | null,
		contentId: null as string | null,

		type,
		status: 'playing' as string | null,

		client: config.serviceName as string | null,
		clientVersion: config.version as string | null,

		timestamp: event.start as any | null,
		artist: event.artist as any | null,
		title: event.title as any | null,
		isrc: event.isrc as any | null,
		email: plugin?.email as any | null,
		duration: Number.parseInt(event.length, 10) as number | null,

		delay: plugin?.delay || (0 as any | null),
		album: plugin?.album || (null as any | null),
		composer: plugin?.composer || (null as any | null),
		program: plugin?.program || (null as any | null),
		subject: plugin?.subject || (null as any | null),
		webURL: plugin?.webUrl || (null as any | null),
		enableShare: !!plugin?.webUrl as any | null,

		enableThumbs:
			plugin?.enableThumbs === true || plugin?.enableThumbs === false ? plugin.enableThumbs : (true as boolean | null),
		year: null as any | null,
		fccId: null as any | null,
		imageURL: null as string | null,
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
			const permittedExcludedField = dts.permittedExcludedFields[field] as keyof typeof liveRadioEvent
			if (permittedExcludedField) {
				liveRadioEvent[permittedExcludedField] = null
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
