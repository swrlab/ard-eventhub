import * as z from 'zod'

import { registerSchema } from './common.ts'

const topicLabelsSchema = z.object({
	id: z.string().optional(),
	'creator-slug': z.string().optional(),
	'publisher-slug': z.string().optional(),
	stage: z.string().optional(),
	created: z.string().optional(),
	'institution-slug': z.string().optional(),
})

export const topicItemSchema = z.object({
	type: z.literal('PUBSUB'),
	id: z.string(),
	name: z.string(),
	path: z.string(),
	labels: topicLabelsSchema.optional(),
})

export const topicResponseSchema = registerSchema(z.array(topicItemSchema), 'topicResponse')

export const topicNameParamSchema = z.object({
	topicName: z.string().min(1),
})
