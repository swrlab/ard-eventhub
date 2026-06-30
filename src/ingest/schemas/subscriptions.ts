import * as z from 'zod'

import { registerSchema } from './common.ts'

export const subscriptionPostSchema = registerSchema(
	z.object({
		type: z.literal('PUBSUB'),
		method: z.literal('PUSH'),
		url: z.string(),
		contact: z.string(),
		topic: z.string(),
	}),
	'subscriptionPost',
)

const subscriptionTopicSchema = z.object({
	id: z.string(),
	name: z.string(),
	path: z.string(),
})

export const subscriptionResponseSchema = registerSchema(
	z.object({
		type: z.literal('PUBSUB'),
		method: z.literal('PUSH'),
		name: z.string(),
		path: z.string(),
		topic: subscriptionTopicSchema,
		ackDeadlineSeconds: z.number().int().optional(),
		retryPolicy: z.string().nullable().optional(),
		serviceAccount: z.string().optional(),
		url: z.string(),
		contact: z.string(),
		institutionId: z.string().optional(),
	}),
	'subscriptionResponse',
)

export const subscriptionsListSchema = registerSchema(
	z.array(subscriptionResponseSchema),
	'subscriptionsList',
)

export const subscriptionDeletedSchema = registerSchema(
	z.object({
		valid: z.boolean(),
		trace: z.string().nullable().optional(),
	}),
	'subscriptionDeleted',
)

export const subscriptionNameParamSchema = z.object({
	subscriptionName: z.string().min(1),
})
