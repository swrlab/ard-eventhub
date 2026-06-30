import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as z from 'zod'

import { version } from '../package.json'
import '@/src/ingest/schemas/index.ts'
import {
	authLoginBodySchema,
	authRefreshBodySchema,
	authResetBodySchema,
	authResponseSchema,
} from '@/src/ingest/schemas/auth.ts'
import { toOpenApiSchema } from '@/src/ingest/schemas/common.ts'
import {
	eventV1PostBodySchema,
	eventV1PostRadioTextBodySchema,
	eventV1PostRadioTextResBodySchema,
	eventV1ResBodySchema,
} from '@/src/ingest/schemas/events.ts'
import {
	subscriptionDeletedSchema,
	subscriptionPostSchema,
	subscriptionResponseSchema,
	subscriptionsListSchema,
} from '@/src/ingest/schemas/subscriptions.ts'
import { topicResponseSchema } from '@/src/ingest/schemas/topics.ts'

const schemaRef = (id: string) => ({ $ref: `#/components/schemas/${id}` })

const registrySchemas = z.toJSONSchema(z.globalRegistry, {
	target: 'openapi-3.0',
	reused: 'ref',
})

const componentsSchemas = {
	...registrySchemas.schemas,
	authResponse: toOpenApiSchema(authResponseSchema),
	eventV1PostBody: toOpenApiSchema(eventV1PostBodySchema),
	eventV1PostRadioTextBody: toOpenApiSchema(eventV1PostRadioTextBodySchema),
	eventV1ResBody: toOpenApiSchema(eventV1ResBodySchema),
	eventV1PostRadioTextResBody: toOpenApiSchema(eventV1PostRadioTextResBodySchema),
	subscriptionPost: toOpenApiSchema(subscriptionPostSchema),
	subscriptionResponse: toOpenApiSchema(subscriptionResponseSchema),
	subscriptionsList: toOpenApiSchema(subscriptionsListSchema),
	subscriptionDeleted: toOpenApiSchema(subscriptionDeletedSchema),
	topicResponse: toOpenApiSchema(topicResponseSchema),
}

const bearerResponses = {
	'401': {
		description: 'Missing authentication',
		content: { 'application/json': { schema: schemaRef('errorUnauthorized') } },
	},
	'403': {
		description: 'Invalid authorization',
		content: { 'application/json': { schema: schemaRef('errorForbidden') } },
	},
}

const document = {
	openapi: '3.0.3',
	info: {
		title: 'ARD Eventhub',
		description:
			'ARD system to distribute real-time (live) metadata for primarily radio broadcasts.',
		termsOfService: 'https://www.ard.de',
		contact: { email: 'lab@swr.de' },
		license: {
			name: 'European Union Public License 1.2',
			url: 'https://spdx.org/licenses/EUPL-1.2.html',
		},
		version,
	},
	externalDocs: {
		description: 'ARD Eventhub Documentation',
		url: 'https://swrlab.github.io/ard-eventhub/',
	},
	servers: [{ url: '/', description: 'Local (domain-relative) environment' }],
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
					content: { 'application/json': { schema: toOpenApiSchema(authLoginBodySchema) } },
				},
				responses: {
					'200': {
						description: 'Authentication successful',
						content: { 'application/json': { schema: schemaRef('authResponse') } },
					},
					'400': {
						description: 'Bad Request (invalid input)',
						content: { 'application/json': { schema: schemaRef('errorBadRequest') } },
					},
					'500': {
						description: 'Internal server error',
						content: { 'application/json': { schema: schemaRef('errorInternalServerError') } },
					},
				},
			},
		},
		'/auth/refresh': {
			post: {
				tags: ['auth'],
				summary: 'Swap refresh token for new id token',
				operationId: 'authRefreshPost',
				requestBody: {
					content: { 'application/json': { schema: toOpenApiSchema(authRefreshBodySchema) } },
				},
				responses: {
					'200': {
						description: 'Authentication successful',
						content: { 'application/json': { schema: schemaRef('authResponse') } },
					},
					'400': {
						description: 'Bad Request (invalid input)',
						content: { 'application/json': { schema: schemaRef('errorBadRequest') } },
					},
					'500': {
						description: 'Internal server error',
						content: { 'application/json': { schema: schemaRef('errorInternalServerError') } },
					},
				},
			},
		},
		'/auth/reset': {
			post: {
				tags: ['auth'],
				summary: 'Request password reset email',
				operationId: 'authResetPost',
				requestBody: {
					content: { 'application/json': { schema: toOpenApiSchema(authResetBodySchema) } },
				},
				responses: {
					'200': { description: 'Request successful', content: {} },
					'400': {
						description: 'Bad Request (invalid input)',
						content: { 'application/json': { schema: schemaRef('errorBadRequest') } },
					},
					'500': {
						description: 'Internal server error',
						content: { 'application/json': { schema: schemaRef('errorInternalServerError') } },
					},
				},
			},
		},
		'/events/de.ard.eventhub.v1.radio.track.next': {
			post: {
				tags: ['events'],
				summary: 'Distribute a next track',
				operationId: 'eventPostV1RadioTrackNext',
				security: [{ bearerAuth: [] }],
				requestBody: { $ref: '#/components/requestBodies/eventV1RadioTrack' },
				responses: {
					'201': { $ref: '#/components/responses/eventV1RadioTrack' },
					'400': {
						description: 'Bad Request (invalid input)',
						content: { 'application/json': { schema: schemaRef('errorBadRequest') } },
					},
					...bearerResponses,
					'500': {
						description: 'Internal server error',
						content: { 'application/json': { schema: schemaRef('errorInternalServerError') } },
					},
				},
			},
		},
		'/events/de.ard.eventhub.v1.radio.text': {
			post: {
				tags: ['events'],
				summary: 'Set a live encoder text for a track',
				operationId: 'eventPostV1RadioText',
				security: [{ bearerAuth: [] }],
				requestBody: { $ref: '#/components/requestBodies/eventPostV1RadioText' },
				responses: {
					'201': { $ref: '#/components/responses/eventPostV1RadioText' },
					'400': {
						description: 'Bad Request (invalid input)',
						content: { 'application/json': { schema: schemaRef('errorBadRequest') } },
					},
					...bearerResponses,
					'500': {
						description: 'Internal server error',
						content: { 'application/json': { schema: schemaRef('errorInternalServerError') } },
					},
				},
			},
		},
		'/events/de.ard.eventhub.v1.radio.track.playing': {
			post: {
				tags: ['events'],
				summary: 'Distribute a now-playing track',
				operationId: 'eventPostV1RadioTrackPlaying',
				security: [{ bearerAuth: [] }],
				requestBody: { $ref: '#/components/requestBodies/eventV1RadioTrack' },
				responses: {
					'201': { $ref: '#/components/responses/eventV1RadioTrack' },
					'400': {
						description: 'Bad Request (invalid input)',
						content: { 'application/json': { schema: schemaRef('errorBadRequest') } },
					},
					...bearerResponses,
					'500': {
						description: 'Internal server error',
						content: { 'application/json': { schema: schemaRef('errorInternalServerError') } },
					},
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
						content: { 'application/json': { schema: schemaRef('subscriptionsList') } },
					},
					...bearerResponses,
					'500': {
						description: 'Internal server error',
						content: { 'application/json': { schema: schemaRef('errorInternalServerError') } },
					},
				},
			},
			post: {
				tags: ['subscriptions'],
				summary: 'Add a new subscription',
				operationId: 'subscriptionPost',
				security: [{ bearerAuth: [] }],
				requestBody: {
					description: 'New event to be distributed to subscribers.',
					required: true,
					content: { 'application/json': { schema: schemaRef('subscriptionPost') } },
				},
				responses: {
					'201': {
						description: 'Subscription created',
						content: { 'application/json': { schema: schemaRef('subscriptionResponse') } },
					},
					'400': {
						description: 'Bad Request (invalid input)',
						content: { 'application/json': { schema: schemaRef('errorBadRequest') } },
					},
					...bearerResponses,
					'404': {
						description: 'Topic for subscription not found',
						content: { 'application/json': { schema: schemaRef('errorNotFound') } },
					},
					'500': {
						description: 'Internal server error',
						content: { 'application/json': { schema: schemaRef('errorInternalServerError') } },
					},
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
						schema: { type: 'string' },
					},
				],
				responses: {
					'200': {
						description: 'Subscription found',
						content: {
							'application/json': {
								schema: { type: 'array', items: schemaRef('subscriptionResponse') },
							},
						},
					},
					...bearerResponses,
					'404': {
						description: 'Subscription not found',
						content: { 'application/json': { schema: schemaRef('errorNotFound') } },
					},
					'500': {
						description: 'Internal server error',
						content: { 'application/json': { schema: schemaRef('errorInternalServerError') } },
					},
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
						schema: { type: 'string' },
					},
				],
				responses: {
					'200': {
						description: 'Subscription deleted',
						content: { 'application/json': { schema: schemaRef('subscriptionDeleted') } },
					},
					...bearerResponses,
					'404': {
						description: 'Subscription not found',
						content: { 'application/json': { schema: schemaRef('errorNotFound') } },
					},
					'500': {
						description: 'Internal server error',
						content: { 'application/json': { schema: schemaRef('errorInternalServerError') } },
					},
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
						content: { 'application/json': { schema: schemaRef('topicResponse') } },
					},
					'500': {
						description: 'Internal server error',
						content: { 'application/json': { schema: schemaRef('errorInternalServerError') } },
					},
				},
			},
		},
	},
	components: {
		requestBodies: {
			eventV1RadioTrack: {
				required: true,
				content: {
					'application/json': { schema: schemaRef('eventV1PostBody') },
				},
			},
			eventPostV1RadioText: {
				required: true,
				content: {
					'application/json': { schema: schemaRef('eventV1PostRadioTextBody') },
				},
			},
		},
		responses: {
			eventV1RadioTrack: {
				description: 'Event created',
				content: { 'application/json': { schema: schemaRef('eventV1ResBody') } },
			},
			eventPostV1RadioText: {
				description: 'Event created',
				content: { 'application/json': { schema: schemaRef('eventV1PostRadioTextResBody') } },
			},
		},
		securitySchemes: {
			bearerAuth: {
				type: 'http',
				scheme: 'bearer',
				bearerFormat: 'JWT',
			},
		},
		schemas: componentsSchemas,
	},
}

const root = process.cwd()
writeFileSync(join(root, 'openapi.json'), `${JSON.stringify(document, null, 2)}\n`)

console.log('Generated openapi.json')
