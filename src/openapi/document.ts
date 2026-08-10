import { z } from 'zod'
import packageJson from '../../package.json' with { type: 'json' }
import {
	authLoginBody,
	authRefreshBody,
	authResetBody,
	authResponse,
	errorBadRequest,
	errorForbidden,
	errorInternalServerError,
	errorNotFound,
	errorUnauthorized,
	eventV1PostBody,
	eventV1PostRadioTextBody,
	eventV1PostRadioTextResBody,
	eventV1ResBody,
	reference,
	services,
	subscriptionDeleted,
	subscriptionPost,
	subscriptionResponse,
	subscriptionsList,
	topicResponse,
} from '../schemas/index.ts'

const schemaById = {
	authLoginBody,
	authRefreshBody,
	authResetBody,
	authResponse,
	errorBadRequest,
	errorUnauthorized,
	errorForbidden,
	errorNotFound,
	errorInternalServerError,
	services,
	reference,
	eventV1PostBody,
	eventV1PostRadioTextBody,
	eventV1ResBody,
	eventV1PostRadioTextResBody,
	subscriptionPost,
	subscriptionResponse,
	subscriptionsList,
	subscriptionDeleted,
	topicResponse,
} as const

/**
 * Convert a Zod schema to an OpenAPI 3.0 Schema Object.
 * @param schema - Zod schema with metadata id
 * @returns JSON Schema / OpenAPI schema object
 */
const toOpenApiSchema = (schema: z.ZodType) => {
	return z.toJSONSchema(schema, {
		target: 'openapi-3.0',
		unrepresentable: 'any',
		reused: 'inline',
	})
}

/**
 * Build `$ref` pointer into components.schemas.
 * @param id - Schema component id
 * @returns OpenAPI $ref object
 */
const ref = (id: keyof typeof schemaById) => ({ $ref: `#/components/schemas/${id}` })

/**
 * Common auth error responses shared across secured endpoints.
 */
const authErrorResponses = {
	'401': {
		description: 'Missing authentication',
		content: {
			'application/json': {
				schema: ref('errorUnauthorized'),
			},
		},
	},
	'403': {
		description: 'Invalid authorization',
		content: {
			'application/json': {
				schema: ref('errorForbidden'),
			},
		},
	},
	'500': {
		description: 'Internal server error',
		content: {
			'application/json': {
				schema: ref('errorInternalServerError'),
			},
		},
	},
}

const badRequestResponse = {
	description: 'Bad Request (invalid input)',
	content: {
		'application/json': {
			schema: ref('errorBadRequest'),
		},
	},
}

const eventTrackRequestBody = {
	description: `
New event to be distributed to subscribers.

The Eventhub format validation expects only a subset of these variables as minimum set. All other fields are technically optional, but **highly encouraged** to be included, so a best-possible metadata exchange is possible.

The subset is defined in the list of required fields of Schemas \`eventV1PostBody\`, resulting in this body:

\`\`\`json
{
  "type": "music",
  "start": "2020-01-19T06:00:00+01:00",
  "title": "Song name",
  "services": [ { ... } ],
  "playlistItemId": "swr3-5678"
}
\`\`\`

Required fields not specified in the Schema, will cause your request to fail.

The \`id\` is inserted by Eventhub as string-formatted number, but might be a true string in the future, do not expect this string to remain numbers only!
`,
	content: {
		'application/json': {
			schema: ref('eventV1PostBody'),
		},
	},
	required: true,
}

const eventTrackResponse = {
	description: `
Event created

*Note:* The first request of an event for an externalId that is not registered yet, will return the status \`failed: 1\`. This indicates that a new topic for the externalId has been created, and the request needs to be repeated:

\`\`\`json
"statuses": {
  "published": 0,
  "blocked": 0,
  "failed": 1
}
\`\`\`

If the request returns the status \`blocked: 1\`, it indicates that you are not allowed to publish events under the given publisherId.
`,
	content: {
		'application/json': {
			schema: ref('eventV1ResBody'),
		},
	},
}

const eventRadioTextRequestBody = {
	description: `
New event to be distributed to subscribers.
The Eventhub format validation expects only a subset of these variables as minimum set. All other fields are technically optional, but **highly encouraged** to be included, so a best-possible metadata exchange is possible.
The subset is defined in the list of required fields of Schemas \`eventV1PostRadioTextBody\`, resulting in this body:
\`\`\`json
{
  "event": "de.ard.eventhub.v1.radio.text",
  "start": "2020-01-19T06:00:00+01:00",
  "validUntil": "2026-01-19T06:00:00+01:00",
  "text": "Catchy one Liner",
  "services": [ { ... } ]
 }
\`\`\`
Required fields not specified in the Schema, will cause your request to fail.
`,
	content: {
		'application/json': {
			schema: ref('eventV1PostRadioTextBody'),
		},
	},
	required: true,
}

const eventRadioTextResponse = {
	description: `
Event created
*Note:* The first request of an event for an externalId that is not registered yet, will return the status \`failed: 1\`. This indicates that a new topic for the externalId has been created, and the request needs to be repeated:
\`\`\`json
"statuses": {
  "published": 0,
  "blocked": 0,
  "failed": 1
}
\`\`\`
If the request returns the status \`blocked: 1\`, it indicates that you are not allowed to publish events under the given publisherId.
`,
	content: {
		'application/json': {
			schema: ref('eventV1PostRadioTextResBody'),
		},
	},
}

/**
 * Assemble the full OpenAPI 3.0 document from Zod schemas + path metadata.
 * @returns OpenAPI document object
 */
export const buildOpenApiDocument = () => {
	const schemas: Record<string, unknown> = {}
	for (const [id, schema] of Object.entries(schemaById)) {
		const jsonSchema = toOpenApiSchema(schema)
		// Drop $schema keyword — OpenAPI component schemas do not use it
		const { $schema: _schema, ...rest } = jsonSchema as Record<string, unknown>
		schemas[id] = rest
	}

	return {
		openapi: '3.0.3',
		info: {
			title: 'ARD Eventhub',
			description: 'ARD system to distribute real-time (live) metadata for primarily radio broadcasts.',
			termsOfService: 'https://www.ard.de',
			contact: {
				email: 'lab@swr.de',
			},
			license: {
				name: 'European Union Public License 1.2',
				url: 'https://spdx.org/licenses/EUPL-1.2.html',
			},
			version: packageJson.version,
		},
		externalDocs: {
			description: 'ARD Eventhub Documentation',
			url: 'https://swrlab.github.io/ard-eventhub/',
		},
		servers: [
			{
				url: '/',
				description: 'Local (domain-relative) environment',
			},
		],
		tags: [
			{ name: 'auth', description: 'Authentication services for Eventhub' },
			{ name: 'events', description: 'Manage events' },
			{ name: 'subscriptions', description: 'Access to subscription management' },
			{ name: 'topics', description: 'Access to topics details' },
		],
		paths: {
			'/auth/login': {
				post: {
					tags: ['auth'],
					summary: 'Swap login credentials for a token',
					operationId: 'authLoginPost',
					requestBody: {
						content: {
							'application/json': {
								schema: ref('authLoginBody'),
							},
						},
					},
					responses: {
						'200': {
							description: 'Authentication successful',
							content: {
								'application/json': {
									schema: ref('authResponse'),
								},
							},
						},
						'400': badRequestResponse,
						'500': authErrorResponses['500'],
					},
				},
			},
			'/auth/refresh': {
				post: {
					tags: ['auth'],
					summary: 'Swap refresh token for new id token',
					operationId: 'authRefreshPost',
					requestBody: {
						content: {
							'application/json': {
								schema: ref('authRefreshBody'),
							},
						},
					},
					responses: {
						'200': {
							description: 'Authentication successful',
							content: {
								'application/json': {
									schema: ref('authResponse'),
								},
							},
						},
						'400': badRequestResponse,
						'500': authErrorResponses['500'],
					},
				},
			},
			'/auth/reset': {
				post: {
					tags: ['auth'],
					summary: 'Request password reset email',
					operationId: 'authResetPost',
					requestBody: {
						content: {
							'application/json': {
								schema: ref('authResetBody'),
							},
						},
					},
					responses: {
						'200': {
							description: 'Request successful',
							content: {},
						},
						'400': badRequestResponse,
						'500': authErrorResponses['500'],
					},
				},
			},
			'/events/de.ard.eventhub.v1.radio.track.next': {
				post: {
					tags: ['events'],
					summary: 'Distribute a next track',
					operationId: 'eventPostV1RadioTrackNext',
					security: [{ bearerAuth: [] }],
					requestBody: eventTrackRequestBody,
					responses: {
						'201': eventTrackResponse,
						'400': badRequestResponse,
						...authErrorResponses,
					},
				},
			},
			'/events/de.ard.eventhub.v1.radio.text': {
				post: {
					tags: ['events'],
					summary: 'Set a live encoder text for a track',
					operationId: 'eventPostV1RadioText',
					security: [{ bearerAuth: [] }],
					requestBody: eventRadioTextRequestBody,
					responses: {
						'201': eventRadioTextResponse,
						'400': badRequestResponse,
						...authErrorResponses,
					},
				},
			},
			'/events/de.ard.eventhub.v1.radio.track.playing': {
				post: {
					tags: ['events'],
					summary: 'Distribute a now-playing track',
					operationId: 'eventPostV1RadioTrackPlaying',
					security: [{ bearerAuth: [] }],
					requestBody: eventTrackRequestBody,
					responses: {
						'201': eventTrackResponse,
						'400': badRequestResponse,
						...authErrorResponses,
					},
				},
			},
			'/subscriptions': {
				get: {
					tags: ['subscriptions'],
					summary: 'List all subscriptions for this user',
					operationId: 'subscriptionList',
					security: [{ bearerAuth: [] }],
					responses: {
						'200': {
							description: 'Subscriptions found',
							content: {
								'application/json': {
									schema: ref('subscriptionsList'),
								},
							},
						},
						...authErrorResponses,
					},
				},
				post: {
					tags: ['subscriptions'],
					summary: 'Add a new subscription',
					operationId: 'subscriptionPost',
					security: [{ bearerAuth: [] }],
					requestBody: {
						description: 'New event to be distributed to subscribers.',
						content: {
							'application/json': {
								schema: ref('subscriptionPost'),
							},
						},
						required: true,
					},
					responses: {
						'201': {
							description: 'Subscription created',
							content: {
								'application/json': {
									schema: ref('subscriptionResponse'),
								},
							},
						},
						'400': badRequestResponse,
						'404': {
							description: 'Topic for subscription not found',
							content: {
								'application/json': {
									schema: ref('errorNotFound'),
								},
							},
						},
						...authErrorResponses,
					},
				},
			},
			'/subscriptions/{name}': {
				get: {
					tags: ['subscriptions'],
					summary: 'Get details about a single subscription from this user',
					operationId: 'subscriptionsGet',
					security: [{ bearerAuth: [] }],
					parameters: [
						{
							name: 'name',
							in: 'path',
							description: '`name` of the desired subscription',
							required: true,
							style: 'simple',
							explode: false,
							schema: { type: 'string' },
						},
					],
					responses: {
						'200': {
							description: 'Subscription found',
							content: {
								'application/json': {
									schema: ref('subscriptionResponse'),
								},
							},
						},
						'404': {
							description: 'Subscription not found',
							content: {
								'application/json': {
									schema: ref('errorNotFound'),
								},
							},
						},
						...authErrorResponses,
					},
				},
				delete: {
					tags: ['subscriptions'],
					summary: 'Remove a single subscription by this user',
					operationId: 'subscriptionsDelete',
					security: [{ bearerAuth: [] }],
					parameters: [
						{
							name: 'name',
							in: 'path',
							description: '`name` of the desired subscription',
							required: true,
							style: 'simple',
							explode: false,
							schema: { type: 'string' },
						},
					],
					responses: {
						'200': {
							description: 'Subscription deleted',
							content: {
								'application/json': {
									schema: ref('subscriptionDeleted'),
								},
							},
						},
						'404': {
							description: 'Subscription not found',
							content: {
								'application/json': {
									schema: ref('errorNotFound'),
								},
							},
						},
						...authErrorResponses,
					},
				},
			},
			'/topics': {
				get: {
					tags: ['topics'],
					summary: 'List all available topics',
					operationId: 'topicsGet',
					security: [{ bearerAuth: [] }],
					responses: {
						'200': {
							description: 'Topics found',
							content: {
								'application/json': {
									schema: ref('topicResponse'),
								},
							},
						},
						'500': authErrorResponses['500'],
					},
				},
			},
		},
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					bearerFormat: 'JWT',
				},
			},
			schemas,
		},
	}
}
