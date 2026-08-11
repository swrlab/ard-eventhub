import { z } from 'zod'

/**
 * Topics list response.
 */
export const topicResponse = z
	.array(
		z.object({
			type: z.enum(['PUBSUB']).meta({ examples: ['PUBSUB'] }),
			id: z.string().meta({ examples: ['urn:ard:permanent-livestream:topic-id'] }),
			name: z.string().meta({ examples: ['de.ard.eventhub.dev.urn%3Aard%3Apermanent-livestream%3Atopic-id'] }),
			path: z.string().meta({ examples: ['projects/ard-eventhub/topics/topic-name'] }),
			labels: z
				.object({
					id: z.string().meta({ examples: ['1234567890'] }),
					'creator-slug': z.string().meta({ examples: ['ard-eventhub-swr'] }),
					'publisher-slug': z.string().meta({ examples: ['swr-rheinland-pfalz'] }),
					stage: z.string().meta({ examples: ['prod'] }),
					created: z.string().meta({ examples: ['2021-03-25'] }),
					'institution-slug': z.string().meta({ examples: ['sudwestrundfunk'] }),
				})
				.passthrough()
				.optional(),
		})
	)
	.meta({ id: 'topicResponse' })
