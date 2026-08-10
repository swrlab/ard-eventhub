import type { AuthUser } from '#types'
import type {
	EventhubPluginMessage,
	EventhubService,
	EventhubV1RadioPostBody,
	EventPluginResult,
	EventProcessResult,
} from '../../schemas/events.ts'
import logger from '@frytg/logger'
import { ulid } from 'ulid'
import { pubSubTopicSelf } from '#config'
import { pubsubBuildId } from '../pubsub/build-id.ts'
import { publishPubSubMessage } from '../pubsub/publish-message.ts'
import { createNewTopic } from './create-new-topic.ts'
import {
	buildEventMessage,
	ensureDefaultPlugins,
	parseEventStart,
	summarizeEventStatuses,
} from './event-helpers.ts'
import { processServices } from './process-services.ts'

const source = 'utils.events.processEvent'

/**
 * Resolve Pub/Sub topic metadata for each service and publish the event.
 * Creates missing topics on first publish.
 * @param message - Event message (mutated: services + topic status)
 * @param attributes - Pub/Sub message attributes
 * @param user - Authenticated user
 * @returns Updated services list
 */
export const publishEventToServices = async (
	message: EventhubV1RadioPostBody,
	attributes: { event: string },
	user: AuthUser
): Promise<EventhubService[]> => {
	const newServices: EventhubService[] = []

	for await (const service of message.services) {
		// ignoring blocked services
		if (!service.blocked && service.topic?.name) {
			// try sending message
			const messageId = await publishPubSubMessage(service.topic.name, message, attributes)

			// handle errors
			if (messageId === 'TOPIC_ERROR') {
				// insert error message and empty id
				service.topic.status = 'TOPIC_ERROR'
				service.topic.messageId = null
			} else if (messageId === 'TOPIC_NOT_FOUND') {
				// first message, create a new topic
				service.topic = await createNewTopic(service, user)
			} else {
				// insert messageId
				service.topic.status = 'MESSAGE_SENT'
				service.topic.messageId = messageId
			}
		}

		newServices.push(service)
	}

	return newServices
}

/**
 * Publish a filtered copy of the event to the shared common topic.
 * @param params - Event name, message, body, attributes, and non-blocked services
 * @returns Common-topic plugin result, or `undefined` when skipped
 */
export const publishEventToCommonTopic = async (params: {
	eventName: string
	message: EventhubV1RadioPostBody
	body: Record<string, unknown>
	attributes: { event: string }
	nonBlockedServices: EventhubService[]
}): Promise<EventPluginResult | undefined> => {
	const { eventName, message, body, attributes, nonBlockedServices } = params

	if (eventName === 'de.ard.eventhub.v1.radio.text') {
		return undefined
	}

	if (nonBlockedServices.length === 0) {
		return undefined
	}

	const topicName = pubsubBuildId(eventName.replace('de.ard.eventhub.', ''))
	const commonEvent = {
		messageId: null as null | string,
		type: 'common',
		topic: {
			id: eventName,
			name: topicName,
		},
	}

	const filteredMessage = {
		...message,
		services: nonBlockedServices,
	}

	commonEvent.messageId = await publishPubSubMessage(topicName, filteredMessage, attributes)

	if (commonEvent.messageId === 'TOPIC_ERROR' || commonEvent.messageId === 'TOPIC_NOT_FOUND') {
		logger.warning({
			message: `failed common plugin > ${eventName} > ${nonBlockedServices[0]?.publisherId}`,
			source,
			data: {
				message: filteredMessage,
				body,
				commonEvent,
			},
		})
	}

	return commonEvent
}

/**
 * Publish active plugin jobs to the internal Pub/Sub topic.
 * @param params - Message, user, attributes, and non-blocked services
 * @returns Plugin publish results
 */
export const publishEventPlugins = async (params: {
	message: EventhubV1RadioPostBody
	user: AuthUser
	attributes: { event: string }
	nonBlockedServices: EventhubService[]
}): Promise<EventPluginResult[]> => {
	const { message, user, attributes, nonBlockedServices } = params
	const pluginMessages: EventPluginResult[] = []

	if (!(message.plugins?.length > 0)) {
		return pluginMessages
	}

	for await (const plugin of message.plugins) {
		if (!plugin.isDeactivated) {
			const pluginMessage: EventhubPluginMessage = {
				action: `plugins.${plugin.type}.event`,
				event: { ...message, services: nonBlockedServices },
				plugin,
				institutionId: user.institution.id,
			}

			const messageId = await publishPubSubMessage(pubSubTopicSelf, pluginMessage, attributes)

			pluginMessages.push({
				type: plugin.type,
				messageId,
			})
		}
	}

	return pluginMessages
}

/**
 * Process a validated event payload: enrich, publish to topics/plugins, return result.
 * Transport-agnostic — usable from HTTP, MQTT, or other ingest paths.
 * @param params - Event name, authenticated user, and event body
 * @returns Publish statuses, plugins, and the enriched event
 */
export const processEvent = async (params: {
	eventName: string
	user: AuthUser
	body: Record<string, unknown>
}): Promise<EventProcessResult> => {
	const { eventName, user, body } = params
	const start = parseEventStart(body.start)
	const attributes = { event: eventName }

	const message = buildEventMessage({ eventName, user, body, start })

	// compile core hashes and pubsub names for every service
	message.services = await Promise.all(message.services.map((service) => processServices(service, { user, eventName })))

	// generate unique Id from the institution id and a random ULID
	message.id = `${user.institution.id}-${ulid()}`

	message.services = await publishEventToServices(message, attributes, user)

	const nonBlockedServices = message.services.filter((service) => !service.blocked)
	const pluginMessages: EventPluginResult[] = []

	const commonResult = await publishEventToCommonTopic({
		eventName,
		message,
		body,
		attributes,
		nonBlockedServices,
	})
	if (commonResult) {
		pluginMessages.push(commonResult)
	}

	ensureDefaultPlugins(message, body)

	pluginMessages.push(
		...(await publishEventPlugins({
			message,
			user,
			attributes,
			nonBlockedServices,
		}))
	)

	const data: EventProcessResult = {
		statuses: summarizeEventStatuses(message.services),
		plugins: pluginMessages,
		event: message,
	}

	logger.log({
		level: data.statuses.blocked > 0 ? 'warning' : 'info',
		message: `event processed > ${eventName} > ${message.services.length}x services > ${message.services[0]?.publisherId}`,
		source,
		data: { ...data, body },
	})

	return data
}
