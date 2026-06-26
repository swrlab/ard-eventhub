import * as z from 'zod'

import { iso8601Timestamp, registerSchema } from './common.ts'

export const serviceSchema = registerSchema(
	z.object({
		type: z.enum(['EventLivestream', 'PermanentLivestream']),
		externalId: z.string(),
		publisherId: z.string(),
		id: z.string().optional(),
	}),
	'services',
)

export const referenceSchema = registerSchema(
	z
		.object({
			type: z.enum(['Episode', 'Section', 'Publication', 'Broadcast', 'Show', 'Season', 'Article']),
			id: z
				.string()
				.regex(/^urn:ard:[a-z0-9-]+:[a-z0-9-]+$/)
				.optional(),
			externalId: z
				.string()
				.regex(/^(c|b)rid:\/\/.+$/)
				.nullable(),
			title: z.string().optional(),
			url: z.string().optional(),
			alternateIds: z.array(z.string()).optional(),
		})
		.strict(),
	'reference',
)

const contributorSchema = z.object({
	name: z.string(),
	role: z.enum([
		'artist',
		'author',
		'composer',
		'performer',
		'conductor',
		'choir',
		'leader',
		'ensemble',
		'orchestra',
		'soloist',
		'producer',
		'engineer',
	]),
	normDb: z
		.object({
			type: z.string(),
			id: z.string(),
		})
		.nullable()
		.optional(),
	isni: z.string().nullable().optional(),
	url: z.string().nullable().optional(),
})

const mediaSchema = z.object({
	type: z.enum(['cover', 'artist', 'anchor', 'audio', 'video']),
	url: z.string(),
	templateUrl: z.string().nullable().optional(),
	description: z.string(),
	attribution: z.string().nullable().optional(),
	isFallback: z.boolean().optional(),
})

const pluginSchema = z.object({
	type: z.string(),
	isDeactivated: z.boolean().optional(),
	note: z.string().optional(),
})

export const eventV1PostBodySchema = registerSchema(
	z
		.object({
			event: z.enum(['de.ard.eventhub.v1.radio.track.playing', 'de.ard.eventhub.v1.radio.track.next']).optional(),
			type: z.enum(['audio', 'commercial', 'jingle', 'live', 'music', 'news', 'traffic', 'weather']),
			start: iso8601Timestamp,
			length: z.number().nullable().optional(),
			title: z.string(),
			artist: z.string().nullable().optional(),
			contributors: z.array(contributorSchema).nullable().optional(),
			services: z.array(serviceSchema).min(1),
			references: z.array(referenceSchema).nullable().optional(),
			playlistItemId: z.string(),
			hfdbIds: z.array(z.string()).nullable().optional(),
			externalId: z.string().nullable().optional(),
			isrc: z.string().nullable().optional(),
			upc: z.string().nullable().optional(),
			mpn: z.string().nullable().optional(),
			media: z.array(mediaSchema).nullable().optional(),
			plugins: z.array(pluginSchema).nullable().optional(),
			id: z.string().optional(),
		})
		.strict(),
	'eventV1PostBody',
)

export const eventV1PostRadioTextBodySchema = registerSchema(
	z
		.object({
			event: z.literal('de.ard.eventhub.v1.radio.text').optional(),
			start: iso8601Timestamp,
			validUntil: iso8601Timestamp,
			text: z.string(),
			services: z.array(serviceSchema).min(1),
		})
		.strict(),
	'eventV1PostRadioTextBody',
)

export const eventV1ResBodySchema = registerSchema(
	z.object({
		statuses: z.object({
			published: z.number().int(),
			blocked: z.number().int(),
			failed: z.number().int(),
		}),
		event: eventV1PostBodySchema,
		plugins: z.array(z.record(z.string(), z.unknown())).optional(),
		trace: z.string().nullable().optional(),
	}),
	'eventV1ResBody',
)

export const eventV1PostRadioTextResBodySchema = registerSchema(
	z.object({
		statuses: z.object({
			published: z.number().int(),
			blocked: z.number().int(),
			failed: z.number().int(),
		}),
		event: eventV1PostRadioTextBodySchema,
		plugins: z.array(z.record(z.string(), z.unknown())).optional(),
		trace: z.string().nullable().optional(),
	}),
	'eventV1PostRadioTextResBody',
)

export const EVENT_RADIO_TEXT = 'de.ard.eventhub.v1.radio.text'

export const getEventBodySchema = (eventName: string) =>
	eventName === EVENT_RADIO_TEXT ? eventV1PostRadioTextBodySchema : eventV1PostBodySchema
