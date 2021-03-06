/* eslint-disable no-nested-ternary */
/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const fetch = require('node-fetch')

// load utils
const logger = require('../../logger')
const secrets = require('../../secrets')

// load config
const config = require('../../../../config')

const source = 'utils/plugins/dts/event'

const defaultHeaders = {
	Accept: 'application/json',
	Connection: 'keep-alive',
	'User-Agent': config.userAgent,
}

const checkIfArrayHasContent = (thisArray) => {
	return Array.isArray(thisArray) && thisArray.length > 0
}

module.exports = async (job) => {
	try {
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

		// collect ARD Core ids
		const coreIds = event.services.map((service) => service?.topic?.id)

		// fetch all externally mapped ids
		const lookupConfig = {
			url: pluginSecrets.endpoints.listIntegrationRecords.replace(
				'{integrationName}',
				pluginSecrets.integrationName
			),
			method: 'GET',
			timeout: 7e3,
			headers: {
				...defaultHeaders,
				Authorization: pluginSecrets.credentials.dashboard,
			},
		}
		const integrationsListAction = await fetch(lookupConfig.url, lookupConfig)

		// end processing if no integrations were found
		if (!integrationsListAction.ok) {
			const errorText = await integrationsListAction.text()
			logger.log({
				level: 'error',
				message: `failed loading DTS integrations (err 1)`,
				source,
				data: { messageId, job, coreIds, errorText },
			})
			return Promise.resolve()
		}

		// parse API result
		const integrationsList = await integrationsListAction.json()

		// end processing if no integrations were found
		if (!checkIfArrayHasContent(integrationsList)) {
			logger.log({
				level: 'error',
				message: `failed loading DTS integrations (err 2)`,
				source,
				data: { messageId, job, coreIds },
			})
			return Promise.resolve()
		}

		// filter IDs matching these services
		const contentIds = integrationsList
			.filter(
				(integration) =>
					integration.external_system === pluginSecrets.integrationName &&
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
		lookupConfig.url = pluginSecrets.endpoints.searchBroadcasts.replace(
			'{contentQuery}',
			contentIds.join(',')
		)
		const broadcastsAction = await fetch(lookupConfig.url, lookupConfig)

		// end processing if no integrations were found
		if (!broadcastsAction.ok) {
			const errorText = await broadcastsAction.text()
			logger.log({
				level: 'error',
				message: `failed loading DTS broadcasts for coreIds (err 4)`,
				source,
				data: { messageId, job, coreIds, errorText },
			})
			return Promise.resolve()
		}

		// parse API result
		const broadcasts = await broadcastsAction.json()

		// end processing if no broadcasts were found
		if (!checkIfArrayHasContent(broadcasts)) {
			logger.log({
				level: 'notice',
				message: `failed finding DTS broadcasts for coreIds (err 5)`,
				source,
				data: { messageId, job, coreIds, contentIds, broadcasts },
			})
			return Promise.resolve()
		}

		// DEV debug data
		logger.log({
			level: 'info',
			message: `DEBUG: ids`,
			source,
			data: { messageId, job, coreIds, integrationsList, contentIds, broadcasts },
		})

		// remap broadcast IDs
		const linkedBroadcastIds = broadcasts.map((broadcast) => broadcast.broadcast_id)

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
				plugin?.enableThumbs === true || plugin?.enableThumbs === false
					? plugin.enableThumbs
					: true,
			year: null,
			fccId: null,
			imageURL: null,
		}

		// set thumbnail
		const mediaType = plugin?.preferArtistMedia ? 'artist' : 'cover'
		const media = event.media?.find((thisMedia) => thisMedia.type === mediaType)
		if (media)
			liveRadioEvent.imageURL =
				media.url || media.templateUrl.replace('{width}', 512).replace('{height}', 512)

		// DEV TEMP workaround
		if (liveRadioEvent.imageURL.indexOf('http://rdz-dev:4001') !== -1)
			liveRadioEvent.imageURL = liveRadioEvent.imageURL.replace(
				'http://rdz-dev:4001',
				'https://onair.swr.de'
			)

		// handle exclusions
		if (checkIfArrayHasContent(plugin.excludeFields)) {
			for (const field of plugin.excludeFields) {
				if (pluginSecrets.permittedExcludedFields[field]) {
					liveRadioEvent[pluginSecrets.permittedExcludedFields[field]] = null
				}
			}
		}

		// post event
		const postConfig = {
			url: pluginSecrets.endpoints.liveRadioEvent[config.stage],
			method: 'POST',
			body: JSON.stringify([liveRadioEvent]),
			timeout: 7e3,
			headers: {
				...defaultHeaders,
				Authorization: pluginSecrets.credentials.liveradio,
				'Content-Type': 'application/json',
			},
		}
		const postAction = await fetch(postConfig.url, postConfig)
		const postText = await postAction.text()

		// log result
		logger.log({
			level: postAction.ok ? 'info' : 'error',
			message: `DTS event posted externally > ${postAction.status}`,
			source,
			data: {
				messageId,
				job,
				ids: { coreIds, contentIds, linkedBroadcastIds },
				status: postAction.status,
				postText,
				liveRadioEvent,
			},
		})

		return Promise.resolve()
	} catch (error) {
		logger.log({
			level: 'error',
			message: 'plugin error',
			source,
			error,
			data: { job },
		})

		return Promise.reject(error)
	}
}
