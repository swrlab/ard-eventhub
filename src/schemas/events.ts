import { z } from 'zod'
import { iso8601Timestamp, responseTrace } from './common.ts'

/**
 * Required string enum that reports missing values as `invalid_type` (OpenAPI required parity).
 * @param values - Allowed enum values
 * @returns Zod schema
 */
const requiredEnum = <const T extends [string, ...string[]]>(values: T) => z.string().pipe(z.enum(values))

/**
 * Service entry attached to an event.
 */
export const services = z
	.object({
		type: requiredEnum(['EventLivestream', 'PermanentLivestream']).meta({ examples: ['PermanentLivestream'] }),
		externalId: z.string().meta({ examples: ['crid://swr.de/123450'] }),
		publisherId: z.string().meta({
			description:
				'External ID or globally unique identifier (Core ID) for the associated publisher. When no Core ID is provided, the External ID will be converted by Eventhub.',
			examples: ['248000'],
		}),
		id: z
			.string()
			.optional()
			.meta({
				description: 'Globally unique identifier, created by Eventhub',
				examples: ['urn:ard:permanent-livestream:49267f7d67be180d'],
			}),
	})
	.meta({ id: 'services' })

/**
 * Related external entity reference.
 */
export const reference = z
	.object({
		type: requiredEnum(['Episode', 'Section', 'Publication', 'Broadcast', 'Show', 'Season', 'Article']),
		id: z
			.string()
			.regex(/^urn:ard:[a-z0-9-]+:[a-z0-9-]+$/)
			.optional()
			.meta({ examples: ['urn:ard:show:49267f7d67be180d'] }),
		externalId: z
			.string()
			.regex(/^(c|b)rid:\/\/.+$/)
			.meta({ examples: ['crid://swr.de/123450'] }),
		title: z.string().optional(),
		url: z.string().url().optional(),
		alternateIds: z
			.array(z.string())
			.optional()
			.meta({ examples: [['https://normdb.ivz.cn.ard.de/sendereihe/427']] }),
	})
	.strict()
	.meta({ id: 'reference' })

const contributorRole = requiredEnum([
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
])

/**
 * Contributor details for a track event.
 */
const contributor = z
	.object({
		name: z.string().meta({ examples: ['Sam Feldt'] }),
		role: contributorRole.meta({ examples: ['artist'] }),
		normDb: z
			.object({
				type: z.string().meta({ examples: ['Person'] }),
				id: z.string().meta({ examples: ['1641010'] }),
			})
			.nullable()
			.optional()
			.meta({ description: "Reference to an entity in ARD's Norm-DB catalog" }),
		isni: z.string().nullable().optional().meta({ description: 'ISNI ID if available' }),
		url: z.string().nullable().optional().meta({ description: 'Can link to external reference' }),
	})
	.meta({ id: 'contributor' })

/**
 * Media file attached to an event.
 */
const mediaItem = z
	.object({
		type: requiredEnum(['cover', 'artist', 'anchor', 'audio', 'video']).meta({ examples: ['cover'] }),
		url: z.string().meta({ examples: ['https://example.com/cover.jpg'] }),
		templateUrl: z
			.string()
			.nullable()
			.optional()
			.meta({ examples: ['https://example.com/cover.jpg?width={width}'] }),
		description: z.string().meta({ examples: ['Cover Demo Artist'] }),
		attribution: z
			.string()
			.nullable()
			.optional()
			.meta({ examples: ['Photographer XYZ'] }),
		isFallback: z
			.boolean()
			.optional()
			.meta({
				description: 'Optional flag to mark media as fallback data that subscribers can filter out',
				examples: [false],
			}),
	})
	.meta({ id: 'mediaItem' })

/**
 * Optional third-party plugin configuration on an event (OpenAPI / request body).
 */
const eventPlugin = z
	.object({
		type: z
			.string()
			.optional()
			.meta({ examples: ['postToThirdPartyPlatformXYZ'] }),
	})
	.passthrough()
	.meta({ id: 'eventPlugin' })

/**
 * Topic metadata attached to a service at runtime after ingest processing.
 */
const eventhubTopic = z.object({
	id: z.string(),
	name: z.string(),
	status: z.string().optional(),
	messageId: z.string().nullable().optional(),
})

/**
 * Service entry after ingest enrichment (blocked flag + topic).
 * Uses plain strings so Pub/Sub / Datastore paths stay assignable.
 */
export const eventhubService = z
	.object({
		type: z.string(),
		externalId: z.string(),
		publisherId: z.string(),
		id: z.string().optional(),
		blocked: z.string().optional(),
		topic: eventhubTopic.optional(),
	})
	.meta({ id: 'eventhubService' })

/**
 * Runtime plugin configuration used by DTS / Radioplayer integrations.
 */
export const eventhubPlugin = z
	.object({
		type: z.string(),
		isDeactivated: z.boolean(),
		note: z.string().optional(),
		delay: z.number().optional(),
		album: z.string().optional(),
		composer: z.string().optional(),
		program: z.string().optional(),
		subject: z.string().optional(),
		webUrl: z.string().optional(),
		preferArtistMedia: z.boolean().optional(),
		enableThumbs: z.boolean().optional(),
		email: z.string().optional(),
		excludeFields: z.array(z.string()).optional(),
	})
	.passthrough()
	.meta({ id: 'eventhubPlugin' })

/**
 * POST /events/de.ard.eventhub.v1.radio.track.* request body.
 */
export const eventV1PostBody = z
	.object({
		event: z
			.enum(['de.ard.eventhub.v1.radio.track.playing', 'de.ard.eventhub.v1.radio.track.next'])
			.optional()
			.meta({
				description: 'If set, it needs to match the URL event parameter',
				examples: ['de.ard.eventhub.v1.radio.track.playing'],
			}),
		type: requiredEnum(['audio', 'commercial', 'jingle', 'live', 'music', 'news', 'traffic', 'weather']).meta({
			description: 'The type of the element that triggered this event. See additional file in docs for details.',
			examples: ['music'],
		}),
		start: iso8601Timestamp,
		length: z
			.number()
			.positive()
			.meta({
				description:
					'Estimated length of the element in seconds. Must be set to a positive number (not 0 or null). The end of the current element is defined by the start of the next element.',
				examples: [240],
			}),
		title: z.string().meta({ description: 'Representative title for external use', examples: ['Song name'] }),
		artist: z
			.string()
			.nullable()
			.optional()
			.meta({ description: 'Pre-formatted artist information', examples: ['Sam Feldt feat. Someone Else'] }),
		contributors: z
			.array(contributor)
			.nullable()
			.optional()
			.meta({ description: 'Full details about involved artists if available' }),
		services: z
			.array(services)
			.meta({ description: 'The playing stations unique Service-IDs. Do not include the Service-Type suffix.' }),
		references: z.array(reference).nullable().optional().meta({ description: 'related external entities' }),
		playlistItemId: z.string().meta({
			description: 'Unique identifier (within a publisher) to connect next and playing items if needed',
			examples: ['swr3-5678'],
		}),
		hfdbIds: z
			.array(z.string())
			.nullable()
			.optional()
			.meta({
				description:
					'Can reference all available tracks in ARD HFDB instances. Should ideally at least include the common ZSK instance.',
				examples: [['swrhfdb1.KONF.12345', 'zskhfdb1.KONF.12345']],
			}),
		externalId: z
			.string()
			.nullable()
			.optional()
			.meta({ description: "Can reference the original ID in the publisher's system", examples: ['M012345.001'] }),
		isrc: z
			.string()
			.nullable()
			.optional()
			.meta({ description: 'Appropriate ISRC code if track is a music element', examples: ['DE012345678'] }),
		upc: z
			.string()
			.nullable()
			.optional()
			.meta({ description: 'Corresponding reference to an album where such ISRC was published' }),
		mpn: z
			.string()
			.nullable()
			.optional()
			.meta({ description: 'If available the reference to the original delivery from MPN' }),
		media: z
			.array(mediaItem)
			.nullable()
			.optional()
			.meta({ description: 'Can contain an array of media files like cover, artist, etc.' }),
		plugins: z.array(eventPlugin).nullable().optional().meta({
			description: 'Highly optional field for future third-party metadata distribution or other connected services',
		}),
		id: z
			.string()
			.optional()
			.meta({
				description:
					'ID gets inserted by Eventhub as string-formatted number, but might be a true string in the future, do not expect this string to remain numbers only!',
				examples: ['1234567890'],
			}),
	})
	.strict()
	.meta({
		id: 'eventV1PostBody',
		description: '**Please also note the details in the `POST /events/v1` endpoint above!**',
	})

/**
 * Event publish success response for track events.
 */
export const eventV1ResBody = z
	.object({
		statuses: z.object({
			published: z
				.number()
				.int()
				.meta({ examples: [1] }),
			blocked: z
				.number()
				.int()
				.meta({ examples: [0] }),
			failed: z
				.number()
				.int()
				.meta({ examples: [0] }),
		}),
		event: eventV1PostBody,
		trace: responseTrace,
	})
	.meta({ id: 'eventV1ResBody' })

/**
 * Contributor shape on enriched runtime events (looser than the HTTP contract).
 */
const eventhubContributor = z.object({
	name: z.string(),
	role: contributorRole.nullable(),
	normDb: z
		.object({
			type: z.string(),
			id: z.string(),
		})
		.nullable(),
	isni: z.string().nullable(),
	url: z.string().nullable(),
})

/**
 * Reference shape on enriched runtime events (looser than the HTTP contract).
 */
const eventhubReference = z.object({
	type: z.string(),
	externalId: z.string(),
	alternateIds: z.array(z.string()),
	id: z.string().optional(),
	title: z.string().optional(),
	url: z.string().optional(),
})

/**
 * Media shape on enriched runtime events.
 */
const eventhubMedia = z.object({
	type: z.string(),
	url: z.string(),
	templateUrl: z.string().nullable(),
	description: z.string(),
	attribution: z.string().nullable(),
	isFallback: z.boolean().optional(),
})

/**
 * Internal event message after ingest enrichment (name/creator/id/plugins/services).
 * Kept intentionally looser than the HTTP schema so plugins can carry runtime fields.
 */
export const eventhubV1RadioPostBody = z
	.object({
		type: z.string(),
		start: z.string(),
		title: z.string(),
		services: z.array(eventhubService),
		playlistItemId: z.string(),
		event: z.string(),
		length: z.number().nullable(),
		artist: z.string().nullable(),
		contributors: z.array(eventhubContributor),
		references: z.array(eventhubReference),
		hfdbIds: z.array(z.string().nullable()),
		externalId: z.string(),
		isrc: z.string().nullable(),
		upc: z.string().nullable(),
		mpn: z.string().nullable(),
		media: z.array(eventhubMedia),
		plugins: z.array(eventhubPlugin),
		validUntil: z.string().optional(),
		text: z.string().optional(),
		name: z.string(),
		creator: z.string(),
		created: z.string(),
		id: z.string(),
	})
	.passthrough()
	.meta({ id: 'eventhubV1RadioPostBody' })

/**
 * Pub/Sub job payload for plugin handlers.
 */
export const eventhubPluginMessage = z
	.object({
		action: z.string(),
		event: eventhubV1RadioPostBody,
		plugin: eventhubPlugin,
		institutionId: z.string(),
	})
	.meta({ id: 'eventhubPluginMessage' })

/**
 * Result of publishing to the common topic or a plugin job.
 */
export const eventPluginResult = z
	.union([
		z.object({
			messageId: z.string().nullable(),
			type: z.string(),
			topic: z.object({
				id: z.string(),
				name: z.string(),
			}),
		}),
		z.object({
			type: z.string(),
			messageId: z.string(),
		}),
	])
	.meta({ id: 'eventPluginResult' })

/**
 * Transport-agnostic result of processing an event publish.
 */
export const eventProcessResult = z
	.object({
		statuses: z.object({
			published: z.number(),
			blocked: z.number(),
			failed: z.number(),
		}),
		plugins: z.array(eventPluginResult),
		event: eventhubV1RadioPostBody,
	})
	.meta({ id: 'eventProcessResult' })

export type EventhubService = z.infer<typeof eventhubService>
export type EventhubPlugin = z.infer<typeof eventhubPlugin>
export type EventhubV1RadioPostBody = z.infer<typeof eventhubV1RadioPostBody>
export type EventhubPluginMessage = z.infer<typeof eventhubPluginMessage>
export type EventPluginResult = z.infer<typeof eventPluginResult>
export type EventProcessResult = z.infer<typeof eventProcessResult>
