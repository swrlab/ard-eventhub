import { z } from 'zod'
import packageJson from '../../package.json' with { type: 'json' }
import { eventV1RadioControlPostBody, eventV1RadioDataPostBody, servicesUrn } from '../schemas/events.ts'

const schemaById = {
	servicesUrn,
	eventV1RadioControlPostBody,
	eventV1RadioDataPostBody,
} as const

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
const schemaRef = (id: keyof typeof schemaById) => ({ $ref: `#/components/schemas/${id}` })

/**
 * Build a `$ref` pointer into `components.messages`.
 * @param id - Message component id
 * @returns AsyncAPI `$ref` object
 */
const messageRef = (id: 'radioControl' | 'radioData') => ({ $ref: `#/components/messages/${id}` })

const inboxTopic = 'inbox/{institutionId}'
const radioControlTopic = 'radio/{livestreamId}/control'
const radioDataTopic = 'radio/{livestreamId}/data'

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
const channelMessageRef = (channelId: string, messageId: string) => ({
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
				'MQTT event contract for Eventhub Connect. Publishers send to `inbox/{institutionId}`; ' +
				'subscribers read validated events on `radio/{livestreamId}/…`. ' +
				'These types are **not** accepted on the HTTPS `POST /events` API. ' +
				'The broker is not deployed yet — host and credentials are placeholders.',
			termsOfService: 'https://www.ard.de',
			contact: {
				email: 'lab@swr.de',
			},
			license: {
				name: 'European Union Public License 1.2',
				url: 'https://spdx.org/licenses/EUPL-1.2.html',
			},
			version: packageJson.version,
			externalDocs: {
				description: 'Eventhub v3 Connect RFC §13',
				url: 'https://swrlab.github.io/ard-eventhub/context-rfc/eventhub-v3-connect#13-new-event-schemas',
			},
		},
		defaultContentType: 'application/json',
		servers: {
			connect: {
				host: 'connect.eventhub.invalid',
				protocol: 'mqtt',
				protocolVersion: '5.0',
				description: 'Placeholder MQTT endpoint. Eventhub Connect is not deployed; do not point clients here yet.',
				security: [{ mqttUserPassword: [] }],
			},
		},
		channels: {
			inboxInstitution: {
				address: inboxTopic,
				title: inboxTopic,
				description:
					'Publisher write path. Send `radio.control` and `radio.data` here. ' +
					'The sidecar validates the payload and republishes onto `radio/{livestreamId}/…`.',
				parameters: {
					institutionId: {
						description: 'Owning institution URN (`urn:ard:institution:…`). Must match the livestream.',
						examples: ['urn:ard:institution:a3004ff924ece1a2'],
					},
				},
				messages: {
					radioControl: messageRef('radioControl'),
					radioData: messageRef('radioData'),
				},
			},
			radioLivestreamControl: {
				address: radioControlTopic,
				title: radioControlTopic,
				description: 'Sidecar output. Retained so a late joiner sees the current control bits. QoS 1, durable.',
				parameters: {
					livestreamId: {
						description: 'Livestream URN (`urn:ard:permanent-livestream:…` or `urn:ard:event-livestream:…`)',
						examples: ['urn:ard:permanent-livestream:49267f7d67be180d'],
					},
				},
				messages: {
					radioControl: messageRef('radioControl'),
				},
			},
			radioLivestreamData: {
				address: radioDataTopic,
				title: radioDataTopic,
				description: 'Sidecar output. Cyclic radiotext / dynamic label / RT+. Retained as the latest cycle. QoS 1.',
				parameters: {
					livestreamId: {
						description: 'Livestream URN (`urn:ard:permanent-livestream:…` or `urn:ard:event-livestream:…`)',
						examples: ['urn:ard:permanent-livestream:49267f7d67be180d'],
					},
				},
				messages: {
					radioData: messageRef('radioData'),
				},
			},
		},
		operations: {
			sendRadioControl: {
				action: 'send',
				title: `Publish radio.control on ${inboxTopic}`,
				description: 'Publish a control-bit change to the institution inbox. Not accepted on HTTPS `POST /events`.',
				channel: channelRef('inboxInstitution'),
				messages: [channelMessageRef('inboxInstitution', 'radioControl')],
				tags: [{ name: 'publish' }],
				bindings: mqttSendBinding,
			},
			sendRadioData: {
				action: 'send',
				title: `Publish radio.data on ${inboxTopic}`,
				description:
					'Publish a cyclic radiotext / RT+ bundle to the institution inbox. Not accepted on HTTPS `POST /events`.',
				channel: channelRef('inboxInstitution'),
				messages: [channelMessageRef('inboxInstitution', 'radioData')],
				tags: [{ name: 'publish' }],
				bindings: mqttSendBinding,
			},
			receiveRadioControl: {
				action: 'receive',
				title: `Subscribe ${radioControlTopic}`,
				description: 'Validated control bits for one livestream. Retained; QoS 1.',
				channel: channelRef('radioLivestreamControl'),
				messages: [channelMessageRef('radioLivestreamControl', 'radioControl')],
				tags: [{ name: 'subscribe' }],
				bindings: mqttRetainBinding,
			},
			receiveRadioData: {
				action: 'receive',
				title: `Subscribe ${radioDataTopic}`,
				description: 'Validated radiotext / dynamic label / RT+ for one livestream. Retained latest cycle; QoS 1.',
				channel: channelRef('radioLivestreamData'),
				messages: [channelMessageRef('radioLivestreamData', 'radioData')],
				tags: [{ name: 'subscribe' }],
				bindings: mqttRetainBinding,
			},
		},

		components: {
			securitySchemes: {
				mqttUserPassword: {
					type: 'userPassword',
					description: 'MQTT username and password issued for Eventhub Connect. Replaces the HTTPS Bearer token.',
				},
			},
			messages: {
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
			},
			schemas,
		},
	}
}
