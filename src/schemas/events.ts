import { z } from 'zod'
import { iso8601Timestamp } from './common.ts'

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
 * Optional third-party plugin configuration on an event.
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
			.nullable()
			.optional()
			.meta({ description: 'Scheduled length of the element in seconds', examples: [240] }),
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
 * POST /events/de.ard.eventhub.v1.radio.text request body.
 */
export const eventV1PostRadioTextBody = z
	.object({
		event: z
			.enum(['de.ard.eventhub.v1.radio.text'])
			.optional()
			.meta({
				description: 'If set, it needs to match the URL event parameter',
				examples: ['de.ard.eventhub.v1.radio.text'],
			}),
		start: iso8601Timestamp,
		validUntil: iso8601Timestamp.meta({
			description: 'ISO8601 compliant timestamp how long this text can be displayed (fallback to title - artist)',
		}),
		text: z.string().meta({
			description: 'one line of Radiotext for live encoder (limited in length)',
			examples: ['Catchy one Liner'],
		}),
		services: z
			.array(services)
			.meta({ description: 'The playing stations unique Service-IDs. Do not include the Service-Type suffix.' }),
	})
	.strict()
	.meta({
		id: 'eventV1PostRadioTextBody',
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
		trace: z
			.string()
			.nullable()
			.meta({ examples: [null] }),
	})
	.meta({ id: 'eventV1ResBody' })

/**
 * Event publish success response for radio text events.
 */
export const eventV1PostRadioTextResBody = z
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
		event: eventV1PostRadioTextBody,
		trace: z
			.string()
			.nullable()
			.meta({ examples: [null] }),
	})
	.meta({ id: 'eventV1PostRadioTextResBody' })

export type EventV1PostBody = z.infer<typeof eventV1PostBody>
export type EventV1PostRadioTextBody = z.infer<typeof eventV1PostRadioTextBody>
