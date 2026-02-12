/*
	ard-eventhub
	by SWR Audio Lab
*/

import { getMs, getMsOffset } from '@frytg/dates'
import logger from '@frytg/logger'
import undici, { type Response } from 'undici'

import type { EventhubPlugin, EventhubPluginMessage, EventhubV1RadioPostBody } from '@/types.eventhub.ts'
import config from '../../../../config/index.ts'
import livestreamMapping from '../../../../config/radioplayer-mapping.json5'
import apiKeys from './api-keys.ts'

const source = 'utils/plugins/radioplayer/event'
const PERMITTED_EXCLUDED_FIELDS = ['imageUrl']
const RUN_IN_NON_PROD = process.env.RADIOPLAYER_RUN_IN_NON_PROD === 'true'

// see API docs: https://radioplayerworldwide.atlassian.net/wiki/spaces/RPC/pages/1920073729/Programmatic+Ingest+of+Station+Information#V2-Endpoints
const RADIOPLAYER_API_URL = 'https://np-ingest.radioplayer.cloud'

type RadioplayerOutput =
	| {
			url: string
			posted: Response | null
			response: string | null
	  }[]
	| null

const sendRadioplayerEvent = async (
	rpUid: string,
	apiKey: string,
	event: EventhubV1RadioPostBody,
	plugin: EventhubPlugin
) => {
	// build URL with query parameters
	const url = new URL(RADIOPLAYER_API_URL)
	url.searchParams.set('rpuid', rpUid as string)
	if (event.artist) url.searchParams.set('artist', event.artist)
	if (event.title) url.searchParams.set('title', event.title)
	if (event.start) url.searchParams.set('startTime', event.start)
	if (event.length) url.searchParams.set('duration', event.length.toString())

	// set thumbnail
	const mediaType = plugin?.preferArtistMedia ? 'artist' : 'cover'
	const media = event.media?.find((thisMedia) => thisMedia.type === mediaType)
	if (media?.url || media?.templateUrl) {
		const imageUrl = media.url || media.templateUrl?.replace('{width}', '512').replace('{height}', '512')
		if (imageUrl) url.searchParams.set('imageUrl', imageUrl)
	}

	// handle exclusions
	if (Array.isArray(plugin.excludeFields) && plugin.excludeFields.length > 0) {
		for (const field of plugin.excludeFields) {
			const permittedExcludedField = PERMITTED_EXCLUDED_FIELDS[field as keyof typeof PERMITTED_EXCLUDED_FIELDS]
			if (permittedExcludedField) {
				url.searchParams.delete(permittedExcludedField)
			}
		}
	}

	// only send event in prod or non-prod if requested
	if (config.stage === 'prod' || RUN_IN_NON_PROD) {
		// post event
		const radioplayerConfig = {
			method: 'POST',
			signal: AbortSignal.timeout(7e3),
			headers: {
				'X-API-KEY': apiKey,
			},
		}
		const posted = await undici.fetch(url.toString(), radioplayerConfig)
		const response = await posted.text()

		// log result
		return { url: url.toString(), posted, response }
	}

	// else return url and null
	return { url: url.toString(), posted: null, response: null }
}

export default async (job: EventhubPluginMessage): Promise<RadioplayerOutput> => {
	// remap input
	const { event, institutionId, plugin } = job
	const output: RadioplayerOutput = []

	// only process now playing events
	if (event.name !== 'de.ard.eventhub.v1.radio.track.playing') {
		logger.warning({
			message: `Radioplayer skipping event (not playing) > ${event.name}`,
			source,
			data: { job },
		})
		return Promise.resolve(null)
	}

	// only process music events
	if (event.type !== 'music') {
		logger.warning({
			message: `Radioplayer skipping event (not music) > ${event.type}`,
			source,
			data: { job },
		})
		return Promise.resolve(null)
	}

	// get API key for institution
	const apiKey = apiKeys[institutionId]
	if (!apiKey) {
		logger.error({
			message: `Radioplayer API key not found for institution > ${institutionId}`,
			source,
			data: { job },
		})
		return Promise.resolve(null)
	}

	// process each service
	for (const service of event.services) {
		// get permanent-livestream ID from service
		// service.topic.id is the permanent-livestream URN (e.g., "urn:ard:permanent-livestream:7c8ea944d2efeeee")
		// or use service.id if available
		const livestreamId = service.topic?.id || service.id

		if (!livestreamId) {
			logger.warning({
				message: 'Radioplayer skipping service (no livestream ID)',
				source,
				data: { service, job },
			})
			continue
		}

		// only process PermanentLivestream services
		if (service.type !== 'PermanentLivestream') {
			logger.warning({
				message: `Radioplayer skipping service (not PermanentLivestream) > ${service.type}`,
				source,
				data: { service, job },
			})
			continue
		}

		// check if livestream is in mapping
		// livestream can be set to false in the mapping to deactivate it
		const rpUidsRaw = livestreamMapping[livestreamId as keyof typeof livestreamMapping]
		if (!rpUidsRaw || rpUidsRaw === false) {
			if (rpUidsRaw !== false) {
				logger.warning({
					message: `Radioplayer skipping service (not in mapping) > ${livestreamId}`,
					source,
					data: { service, job },
				})
			}
			continue
		}

		// mapping can be string or array of strings
		const rpUids = Array.isArray(rpUidsRaw) ? rpUidsRaw : [rpUidsRaw]

		// send event for each RP UID
		let i = 0
		for (const rpUid of rpUids) {
			const startTime = getMs()
			const { url, posted, response } = await sendRadioplayerEvent(rpUid, apiKey, event, plugin)
			output.push({ url, posted, response })

			// log result
			const message = [
				`Radioplayer ${i + 1}/${rpUids.length} event done (${service.publisherId})`,
				`status ${posted.status}`,
				`rpuid ${rpUid}`,
				`in ${getMsOffset(startTime)}ms`,
			]
			logger.log({
				level: posted.ok ? 'info' : 'error',
				message: message.join(' > '),
				source,
				data: { rpUid, statusCode: posted.status, response, url: url.toString() },
			})
			i += 1
		}
	}

	return Promise.resolve(output)
}
