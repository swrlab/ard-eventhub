/*
	ard-eventhub
	by SWR Audio Lab
*/

import logger from '@frytg/logger'
import undici from 'undici'

import type { EventhubPluginMessage } from '@/types.eventhub.ts'
import livestreamMapping from '../../../../config/radioplayer-mapping.json' with { type: 'json' }
import apiKeys from './api-keys.ts'

const source = 'utils/plugins/radioplayer/event'

// see API docs: https://radioplayerworldwide.atlassian.net/wiki/spaces/RPC/pages/1920073729/Programmatic+Ingest+of+Station+Information#V2-Endpoints
const RADIOPLAYER_API_URL = 'https://np-ingest.radioplayer.cloud'

export default async (job: EventhubPluginMessage) => {
	// remap input
	const { event, institutionId } = job

	// only process now playing events
	if (event.name !== 'de.ard.eventhub.v1.radio.track.playing') {
		logger.log({
			level: 'warning',
			message: `Radioplayer skipping event (not playing) > ${event.name}`,
			source,
			data: { job },
		})
		return Promise.resolve()
	}

	// only process music events
	if (event.type !== 'music') {
		logger.log({
			level: 'warning',
			message: `Radioplayer skipping event (not music) > ${event.type}`,
			source,
			data: { job },
		})
		return Promise.resolve()
	}

	// get API key for institution
	const apiKey = apiKeys[institutionId]
	if (!apiKey) {
		logger.log({
			level: 'error',
			message: `Radioplayer API key not found for institution > ${institutionId}`,
			source,
			data: { job },
		})
		return Promise.resolve()
	}

	// process each service
	for (const service of event.services) {
		// get permanent-livestream ID from service
		// service.topic.id is the permanent-livestream URN (e.g., "urn:ard:permanent-livestream:7c8ea944d2efeeee")
		// or use service.id if available
		const livestreamId = service.topic?.id || service.id

		if (!livestreamId) {
			logger.log({
				level: 'debug',
				message: 'Radioplayer skipping service (no livestream ID)',
				source,
				data: { service, job },
			})
			continue
		}

		// only process PermanentLivestream services
		if (service.type !== 'PermanentLivestream') {
			logger.log({
				level: 'debug',
				message: `Radioplayer skipping service (not PermanentLivestream) > ${service.type}`,
				source,
				data: { service, job },
			})
			continue
		}

		// check if livestream is in mapping
		// livestream can be set to false in the mapping to deactivate it
		const rpUid = livestreamMapping[livestreamId as keyof typeof livestreamMapping]
		if (!rpUid && rpUid !== false) {
			logger.log({
				level: 'debug',
				message: `Radioplayer skipping service (not in mapping) > ${livestreamId}`,
				source,
				data: { service, job },
			})
			continue
		}

		// build URL with query parameters
		const url = new URL(RADIOPLAYER_API_URL)
		url.searchParams.set('rpuid', rpUid as string)
		if (event.artist) url.searchParams.set('artist', event.artist)
		if (event.title) url.searchParams.set('title', event.title)
		if (event.start) url.searchParams.set('startTime', event.start)
		if (event.length) url.searchParams.set('duration', event.length.toString())

		// post event
		const radioplayerConfig = {
			method: 'POST',
			timeout: 7e3,
			reject: false,
			headers: {
				'X-API-KEY': apiKey,
			},
		}
		const posted = await undici.fetch(url.toString(), radioplayerConfig)
		const response = await posted.text()

		// log result
		const message = [`Radioplayer event done (${service.publisherId})`, `status ${posted.status}`, `rpuid ${rpUid}`]
		logger.log({
			level: posted.ok ? 'info' : 'error',
			message: message.join(' > '),
			source,
			data: {
				input: job,
				radioplayer: {
					rpUid,
					statusCode: posted.status,
					response,
					url: url.toString(),
				},
			},
		})
	}

	return Promise.resolve()
}
