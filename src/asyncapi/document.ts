import { z } from 'zod'
import packageJson from '../../package.json' with { type: 'json' }
import {
	connectInboxTrackEvent,
	eventV1RadioControlPostBody,
	eventV1RadioDataPostBody,
	servicesUrn,
	validationFeedbackBody,
} from '../schemas/events.ts'

const TRACK_PLAYING = 'de.ard.eventhub.v1.radio.track.playing'
const TRACK_NEXT = 'de.ard.eventhub.v1.radio.track.next'

/**
 * MQTT track payload for one class. `event` is the literal that selects the `radio/` topic.
 * @param eventName - `track.playing` or `track.next`
 * @param id - Schema component id
 * @param description - Schema description shown on the events page
 * @returns URN-only track schema with that event literal
 */
const connectTrackEvent = (eventName: typeof TRACK_PLAYING | typeof TRACK_NEXT, id: string, description: string) =>
	connectInboxTrackEvent
		.omit({ event: true, id: true, services: true })
		.extend({
			event: z.literal(eventName).meta({
				description: 'Event class. It selects the `radio/` topic after validation.',
				examples: [eventName],
			}),
			id: z
				.string()
				.optional()
				.meta({
					description: 'Optional id supplied by the publisher. Connect does not assign one.',
					examples: ['1234567890'],
				}),
			services: z.array(servicesUrn).min(1).meta({
				description: 'URN-only service identifiers. `id` is the livestream URN used in the `radio/` topic.',
			}),
		})
		.strict()
		.meta({ id, description })

const schemaById = {
	servicesUrn,
	connectInboxTrackPlaying: connectTrackEvent(
		TRACK_PLAYING,
		'connectInboxTrackPlaying',
		'Now-playing item on Eventhub Connect. URN-only `services[]`. `created` is the delivery time.'
	),
	connectInboxTrackNext: connectTrackEvent(
		TRACK_NEXT,
		'connectInboxTrackNext',
		'Planned next item on Eventhub Connect. URN-only `services[]`. `created` is the delivery time.'
	),
	eventV1RadioControlPostBody,
	eventV1RadioDataPostBody,
	validationFeedbackBody,
} as const

type SchemaId = keyof typeof schemaById

const messageIds = ['radioTrackPlaying', 'radioTrackNext', 'radioControl', 'radioData', 'validationFeedback'] as const

type MessageId = (typeof messageIds)[number]

/**
 * Flatten a named Zod JSON Schema (`$ref` + `definitions`/`$defs`) into the resolved object.
 * @param jsonSchema - Output of `z.toJSONSchema` without `$schema`
 * @returns Resolved schema object
 */
const unwrapNamedSchema = (jsonSchema: Record<string, unknown>): Record<string, unknown> => {
	const ref = jsonSchema.$ref
	const definitions = (jsonSchema.definitions ?? jsonSchema.$defs) as Record<string, unknown> | undefined
	if (typeof ref !== 'string' || !definitions) return jsonSchema

	const name = ref.split('/').pop()
	const resolved = name && definitions[name]
	if (!resolved || typeof resolved !== 'object') return jsonSchema

	const restDefs = { ...definitions }
	delete restDefs[name]
	const unwrapped = { ...(resolved as Record<string, unknown>) }
	if (Object.keys(restDefs).length > 0) {
		if ('definitions' in jsonSchema) unwrapped.definitions = restDefs
		else unwrapped.$defs = restDefs
	}
	return unwrapped
}

/**
 * Convert a Zod schema to a JSON Schema draft-07 object for AsyncAPI 3 payloads.
 * @param schema - Zod schema with metadata id
 * @returns JSON Schema object without the `$schema` keyword
 */
const toAsyncApiSchema = (schema: z.ZodType): Record<string, unknown> => {
	const jsonSchema = z.toJSONSchema(schema, {
		target: 'draft-7',
		unrepresentable: 'any',
		reused: 'inline',
	})
	const { $schema: _schema, ...rest } = jsonSchema as Record<string, unknown>
	return unwrapNamedSchema(rest)
}

/**
 * Build a `$ref` pointer into `components.schemas`.
 * @param id - Schema component id
 * @returns AsyncAPI `$ref` object
 */
const schemaRef = (id: SchemaId) => ({ $ref: `#/components/schemas/${id}` })

/**
 * Build a `$ref` pointer into `components.messages`.
 * @param id - Message component id
 * @returns AsyncAPI `$ref` object
 */
const messageRef = (id: MessageId) => ({ $ref: `#/components/messages/${id}` })

const inboxTopic = 'inbox/{institutionId}'
const feedbackTopic = 'feedback/{institutionId}'
const radioTrackPlayingTopic = 'radio/{livestreamId}/track/playing'
const radioTrackNextTopic = 'radio/{livestreamId}/track/next'
const radioControlTopic = 'radio/{livestreamId}/control'
const radioDataTopic = 'radio/{livestreamId}/data'

const institutionParameter = {
	institutionId: {
		description: 'Owning institution URN (`urn:ard:institution:…`). Must match the livestream.',
		examples: ['urn:ard:institution:a3004ff924ece1a2'],
	},
}

const livestreamParameter = {
	livestreamId: {
		description: 'Livestream URN (`urn:ard:permanent-livestream:…` or `urn:ard:event-livestream:…`)',
		examples: ['urn:ard:permanent-livestream:49267f7d67be180d'],
	},
}

/**
 * Build a `$ref` pointer into `channels`.
 * @param channelId - Stable camelCase channel id (not the MQTT path)
 * @returns AsyncAPI `$ref` object
 */
const channelRef = (channelId: string) => ({ $ref: `#/channels/${channelId}` })

/**
 * Build a `$ref` pointer into a channel's message map.
 * @param channelId - Stable camelCase channel id
 * @param messageId - Message name on that channel
 * @returns AsyncAPI `$ref` object
 */
const channelMessageRef = (channelId: string, messageId: MessageId) => ({
	$ref: `#/channels/${channelId}/messages/${messageId}`,
})

const mqttSendBinding = {
	mqtt: {
		qos: 1,
		retain: false,
	},
}

const mqttRetainBinding = {
	mqtt: {
		qos: 1,
		retain: true,
	},
}

type EventTypeDoc = 'track.playing' | 'track.next' | 'control' | 'data' | 'feedback'

/**
 * Prose page under `docs/event/`. Event classes are `radio.{type}.mdx`; feedback is `feedback.mdx`.
 * @param type - Event class token, or `feedback`
 * @returns Site path of the prose page, without the docs base
 */
const eventTypeDocPath = (type: EventTypeDoc): string =>
	type === 'feedback' ? '/event/feedback' : `/event/radio.${type}`

/**
 * Prose page for one payload. Linked from the matching send and receive operations.
 * @param type - Event class token, or `feedback`
 * @returns AsyncAPI externalDocs object
 */
const eventTypeDoc = (type: EventTypeDoc) => ({
	description: type === 'feedback' ? 'feedback/{institutionId}' : `de.ard.eventhub.v1.radio.${type}`,
	url: `https://swrlab.github.io/ard-eventhub${eventTypeDocPath(type)}`,
})

/**
 * Markdown link to the prose page. Blume renders the operation description and skips `externalDocs`.
 * @param type - Event class token, or `feedback`
 * @returns Link shown on the send and receive pages
 */
const eventTypeLink = (type: EventTypeDoc): string =>
	type === 'feedback'
		? `[feedback](${eventTypeDocPath(type)})`
		: `[de.ard.eventhub.v1.radio.${type}](${eventTypeDocPath(type)})`

/**
 * Sentence appended to an operation description. Blume shows this; it does not render `externalDocs`.
 * @param type - Event class token, or `feedback`
 * @returns Sentence with the prose-page link
 */
const eventTypeSentence = (type: EventTypeDoc): string =>
	type === 'feedback' ? `Schema: ${eventTypeLink(type)}.` : `Event type: ${eventTypeLink(type)}.`

/**
 * Retained `radio/` channel for one event class.
 * @param address - MQTT topic with `{livestreamId}`
 * @param description - What a subscriber receives
 * @param messageId - Message on this channel
 * @returns AsyncAPI channel object
 */
const radioChannel = (address: string, description: string, messageId: MessageId) => ({
	address,
	title: address,
	description,
	parameters: livestreamParameter,
	messages: {
		[messageId]: messageRef(messageId),
	},
})

/**
 * Publisher send on the institution inbox.
 * @param title - Operation title
 * @param description - What the publisher sends
 * @param messageId - Inbox message
 * @param doc - Prose page for this event class, omitted for operations without one
 * @returns AsyncAPI send operation
 */
const sendInbox = (title: string, description: string, messageId: MessageId, doc?: EventTypeDoc) => ({
	action: 'send' as const,
	title,
	description,
	channel: channelRef('inboxInstitution'),
	messages: [channelMessageRef('inboxInstitution', messageId)],
	tags: [{ name: 'publish' }],
	bindings: mqttSendBinding,
	...(doc ? { description: `${description} ${eventTypeSentence(doc)}`, externalDocs: eventTypeDoc(doc) } : {}),
})

/**
 * Subscriber receive on a retained topic.
 * @param title - Operation title
 * @param description - What the subscriber receives
 * @param channelId - Channel the operation reads
 * @param messageId - Message on that channel
 * @param doc - Prose page for this payload
 * @returns AsyncAPI receive operation
 */
const receiveRetained = (
	title: string,
	description: string,
	channelId: string,
	messageId: MessageId,
	doc?: EventTypeDoc
) => ({
	action: 'receive' as const,
	title,
	description,
	channel: channelRef(channelId),
	messages: [channelMessageRef(channelId, messageId)],
	tags: [{ name: 'subscribe' }],
	bindings: mqttRetainBinding,
	...(doc ? { description: `${description} ${eventTypeSentence(doc)}`, externalDocs: eventTypeDoc(doc) } : {}),
})

/**
 * Assemble the AsyncAPI 3.0 document for Eventhub Connect (MQTT).
 * Envelope (channels, operations, bindings) is hand-written; payloads come from Zod.
 * @returns AsyncAPI document object
 */
export const buildAsyncApiDocument = () => {
	const schemas: Record<string, unknown> = {}
	for (const [id, schema] of Object.entries(schemaById)) {
		schemas[id] = toAsyncApiSchema(schema)
	}

	return {
		asyncapi: '3.0.0',
		info: {
			title: 'ARD Eventhub Connect',
			description:
				'MQTT 3.1.1 event contract for Eventhub Connect. Publishers send `track.playing`, `track.next`, ' +
				'`radio.control`, and `radio.data` to `inbox/{institutionId}` and subscribe to rejections on ' +
				'`feedback/{institutionId}`. Subscribers read the validated event on ' +
				'`radio/{livestreamId}/track/playing`, `…/track/next`, `…/control`, or `…/data`. ' +
				'TLS port 8883; configure `connect-bad`, `connect-stg`, and `connect-mnz` in the stage DNS. ' +
				'`radio.control` and `radio.data` are not accepted on the HTTPS `POST /events` API. ' +
				'The server host below is a placeholder; connection details are in the publisher migration guide.',
			termsOfService: 'https://www.ard.de',
			contact: {
				email: 'lab@swr.de',
			},
			license: {
				name: 'MIT',
				url: 'https://spdx.org/licenses/MIT.html',
			},
			version: packageJson.version,
			externalDocs: {
				description: 'Eventhub v3 Connect RFC §6.2',
				url: 'https://swrlab.github.io/ard-eventhub/context-rfc/eventhub-v3-connect#62-topic-tree',
			},
		},
		defaultContentType: 'application/json',
		servers: {
			connect: {
				host: 'connect.eventhub.invalid',
				protocol: 'mqtt',
				protocolVersion: '3.1.1',
				description:
					'Placeholder host. Clients use mqtts on port 8883 against connect-bad, connect-stg, and connect-mnz in the stage DNS. MQTT 5 is rejected.',
				security: [{ mqttUserPassword: [] }],
			},
		},
		channels: {
			inboxInstitution: {
				address: inboxTopic,
				title: inboxTopic,
				description:
					'Publisher write path for every event class. Eventhub validates the payload and republishes an accepted event onto `radio/{livestreamId}/…`. A rejection is retained on `feedback/{institutionId}`.',
				parameters: institutionParameter,
				messages: {
					radioTrackPlaying: messageRef('radioTrackPlaying'),
					radioTrackNext: messageRef('radioTrackNext'),
					radioControl: messageRef('radioControl'),
					radioData: messageRef('radioData'),
				},
			},
			radioLivestreamTrackPlaying: radioChannel(
				radioTrackPlayingTopic,
				'Validation output. Retained so a late joiner sees the current now-playing item. QoS 1.',
				'radioTrackPlaying'
			),
			radioLivestreamTrackNext: radioChannel(
				radioTrackNextTopic,
				'Validation output. Retained latest planned next item. QoS 1.',
				'radioTrackNext'
			),
			radioLivestreamControl: radioChannel(
				radioControlTopic,
				'Validation output. Retained so a late joiner sees the current control bits. QoS 1, durable.',
				'radioControl'
			),
			radioLivestreamData: radioChannel(
				radioDataTopic,
				'Validation output. Cyclic radiotext / dynamic label / RT+. Retained as the latest cycle. QoS 1.',
				'radioData'
			),
			feedbackInstitution: {
				address: feedbackTopic,
				title: feedbackTopic,
				description:
					'Publisher diagnostic. The last rejection for this institution, retained. Not an acknowledgement: an accepted event writes nothing here. QoS 1.',
				parameters: institutionParameter,
				messages: {
					validationFeedback: messageRef('validationFeedback'),
				},
			},
		},
		operations: {
			sendRadioTrackPlaying: sendInbox(
				`Publish track.playing on ${inboxTopic}`,
				'Publish a now-playing item to the institution inbox.',
				'radioTrackPlaying',
				'track.playing'
			),
			sendRadioTrackNext: sendInbox(
				`Publish track.next on ${inboxTopic}`,
				'Publish a planned next item to the institution inbox.',
				'radioTrackNext',
				'track.next'
			),
			sendRadioControl: sendInbox(
				`Publish radio.control on ${inboxTopic}`,
				'Publish a control-bit change to the institution inbox. Not accepted on HTTPS `POST /events`.',
				'radioControl',
				'control'
			),
			sendRadioData: sendInbox(
				`Publish radio.data on ${inboxTopic}`,
				'Publish a cyclic radiotext / RT+ bundle to the institution inbox. Not accepted on HTTPS `POST /events`.',
				'radioData',
				'data'
			),
			receiveRadioTrackPlaying: receiveRetained(
				`Subscribe ${radioTrackPlayingTopic}`,
				'Validated now-playing item for one livestream. Retained; QoS 1. The livestream URN is `services[].id`.',
				'radioLivestreamTrackPlaying',
				'radioTrackPlaying',
				'track.playing'
			),
			receiveRadioTrackNext: receiveRetained(
				`Subscribe ${radioTrackNextTopic}`,
				'Validated next item for one livestream. Retained; QoS 1. The livestream URN is `services[].id`.',
				'radioLivestreamTrackNext',
				'radioTrackNext',
				'track.next'
			),
			receiveRadioControl: receiveRetained(
				`Subscribe ${radioControlTopic}`,
				'Validated control bits for one livestream. Retained; QoS 1.',
				'radioLivestreamControl',
				'radioControl',
				'control'
			),
			receiveRadioData: receiveRetained(
				`Subscribe ${radioDataTopic}`,
				'Validated radiotext / dynamic label / RT+ for one livestream. Retained latest cycle; QoS 1.',
				'radioLivestreamData',
				'radioData',
				'data'
			),
			receiveFeedback: receiveRetained(
				`Subscribe ${feedbackTopic}`,
				'Last rejection for this institution. Correlate track events by `playlistItemId`, control and data by `start`. Retained; QoS 1.',
				'feedbackInstitution',
				'validationFeedback',
				'feedback'
			),
		},

		components: {
			securitySchemes: {
				mqttUserPassword: {
					type: 'userPassword',
					description: 'MQTT username and password issued for Eventhub Connect. Replaces the HTTPS Bearer token.',
				},
			},
			messages: {
				radioTrackPlaying: {
					name: TRACK_PLAYING,
					title: 'track.playing',
					summary: 'Now-playing item. Retained on `radio/{livestreamId}/track/playing` after validation.',
					contentType: 'application/json',
					payload: schemaRef('connectInboxTrackPlaying'),
				},
				radioTrackNext: {
					name: TRACK_NEXT,
					title: 'track.next',
					summary: 'Planned next item. Retained on `radio/{livestreamId}/track/next` after validation.',
					contentType: 'application/json',
					payload: schemaRef('connectInboxTrackNext'),
				},
				radioControl: {
					name: 'de.ard.eventhub.v1.radio.control',
					title: 'radio.control',
					summary: 'Control bits (TA, TP, EON, Regio, …). `name` is a free string, not an enum.',
					contentType: 'application/json',
					payload: schemaRef('eventV1RadioControlPostBody'),
				},
				radioData: {
					name: 'de.ard.eventhub.v1.radio.data',
					title: 'radio.data',
					summary: 'Cyclic radiotext, dynamic label, and RT+/DL+ bundle.',
					contentType: 'application/json',
					payload: schemaRef('eventV1RadioDataPostBody'),
				},
				validationFeedback: {
					name: 'feedback',
					title: 'feedback',
					summary:
						'Last rejection for one institution. Not an acknowledgement: a successful publish writes nothing here.',
					contentType: 'application/json',
					payload: schemaRef('validationFeedbackBody'),
				},
			},
			schemas,
		},
	}
}
