import { z } from 'zod'

/**
 * Required string enum that reports missing values as `invalid_type` (OpenAPI required parity).
 * @param values - Allowed enum values
 * @returns Zod schema
 */
const requiredEnum = <const T extends [string, ...string[]]>(values: T) => z.string().pipe(z.enum(values))

const subscriptionTopic = z.object({
	id: z.string().meta({ examples: ['urn:ard:permanent-livestream:topic-id'] }),
	name: z.string().meta({ examples: ['de.ard.eventhub.dev.urn%3Aard%3Apermanent-livestream%3Atopic-id'] }),
	path: z.string().meta({ examples: ['projects/ard-eventhub/topics/topic-name'] }),
})

/**
 * POST /subscriptions request body.
 */
export const subscriptionPost = z
	.object({
		type: requiredEnum(['PUBSUB']).meta({ examples: ['PUBSUB'] }),
		method: requiredEnum(['PUSH']).meta({ examples: ['PUSH'] }),
		url: z.string().meta({
			description: 'Publicly accessible URL that should receive the events',
			examples: ['https://example.com/my/webhook/for/this/subscription'],
		}),
		contact: z.string().meta({
			description: 'Email address to be contacted in case of problems with this subscription',
			examples: ['my-emergency-and-notifications-contact@ard.de'],
		}),
		topic: z.string().meta({
			description: 'ID of the topic to subscribe to',
			examples: ['topic-id-to-subscribe-to'],
		}),
	})
	.meta({ id: 'subscriptionPost' })

/**
 * Subscription response object (OpenAPI docs).
 */
export const subscriptionResponse = z
	.object({
		type: z.enum(['PUBSUB']).meta({ examples: ['PUBSUB'] }),
		method: z.enum(['PUSH']).meta({ examples: ['PUSH'] }),
		name: z.string().meta({
			description: 'ID of the subscription to be referenced in API calls',
			examples: ['de.ard.eventhub.subscription.subscription-id'],
		}),
		path: z.string().meta({
			description: 'Path of subscription in project',
			examples: ['projects/ard-eventhub/subscriptions/subscription-name'],
		}),
		topic: subscriptionTopic,
		ackDeadlineSeconds: z
			.number()
			.int()
			.meta({ examples: [20] }),
		retryPolicy: z
			.string()
			.nullable()
			.optional()
			.meta({ examples: [null] }),
		serviceAccount: z.string().meta({ examples: ['name-of-service-account'] }),
		url: z.string().meta({
			description: 'Publicly accessible URL that should receive the events',
			examples: ['https://example.com/my/webhook/for/this/subscription'],
		}),
		contact: z.string().meta({
			description: 'Email address to be contacted in case of problems with this subscription',
			examples: ['my-emergency-and-notifications-contact@ard.de'],
		}),
		institutionId: z.string().meta({
			description: 'ID of the institution the current user belongs to',
			examples: ['urn:ard:institution:institution-id'],
		}),
	})
	.meta({ id: 'subscriptionResponse' })

/**
 * List of subscriptions.
 */
export const subscriptionsList = z.array(subscriptionResponse).meta({ id: 'subscriptionsList' })

/**
 * Subscription deleted response.
 */
export const subscriptionDeleted = z
	.object({
		valid: z.boolean().meta({ examples: [true] }),
		trace: z
			.string()
			.nullable()
			.meta({ examples: [null] }),
	})
	.meta({ id: 'subscriptionDeleted' })

/**
 * Subscription record stored in Datastore.
 */
export const subscriptionDatastore = z
	.object({
		id: z.union([z.string(), z.number()]).optional(),
		name: z.string(),
		type: z.string(),
		method: z.string(),
		url: z.string(),
		contact: z.string(),
		topic: z.string(),
		creator: z.string(),
		institutionId: z.string(),
		created: z.string(),
	})
	.meta({ id: 'subscriptionDatastore' })

/**
 * Limited subscription view returned by the API runtime (defensive / partial fields).
 */
export const subscriptionLimited = z
	.object({
		type: z.string(),
		method: z.string(),
		name: z.string().optional(),
		path: z.string().nullable().optional(),
		topic: subscriptionTopic,
		ackDeadlineSeconds: z.number().nullable().optional(),
		retryPolicy: z.record(z.string(), z.any()).nullable().optional(),
		serviceAccount: z.string().nullable().optional(),
		url: z.string().nullable().optional(),
		contact: z.string().optional(),
		institutionId: z.string().optional(),
	})
	.meta({ id: 'subscriptionLimited' })

/**
 * Limited subscription plus Pub/Sub labels (used for delete / ownership checks).
 */
export const subscriptionWithLabels = subscriptionLimited
	.extend({
		labels: z
			.object({
				id: z.string(),
				stage: z.string(),
				'creator-slug': z.string(),
				created: z.string(),
			})
			.optional(),
	})
	.meta({ id: 'subscriptionWithLabels' })

/**
 * Topic record stored in Datastore when a new service topic is created.
 */
export const topicDatastore = z
	.object({
		created: z.string(),
		creator: z.string(),
		coreId: z.string(),
		externalId: z.string(),
		name: z.string(),
		institution: z.object({
			id: z.string(),
			title: z.string(),
		}),
		publisher: z.object({
			id: z.string(),
			title: z.string(),
		}),
	})
	.meta({ id: 'topicDatastore' })

export type SubscriptionPost = z.infer<typeof subscriptionPost>
export type EventhubSubscriptionDatastore = z.infer<typeof subscriptionDatastore>
export type EventhubSubscriptionLimited = z.infer<typeof subscriptionLimited>
export type EventhubSubscriptionWithLabels = z.infer<typeof subscriptionWithLabels>
export type EventhubTopicDatastore = z.infer<typeof topicDatastore>
