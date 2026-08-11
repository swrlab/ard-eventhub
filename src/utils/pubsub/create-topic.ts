import type { ITopic } from '#types'
import type { EventhubTopicDatastore } from '../../schemas/subscriptions.ts'
import { DateTime } from '@frytg/dates'
import slug from 'slug'
import { projectId, stage } from '#env'
import { publisherClient } from './_publisher-client.ts'

export const pubsubCreateTopic = async (newTopic: EventhubTopicDatastore & { id: string }) => {
	const topic: ITopic = {
		name: `projects/${projectId}/topics/${newTopic.name}`,
		labels: {
			created: DateTime.now().toFormat('yyyy-LL-dd'),
			'creator-slug': slug(newTopic.creator),

			id: newTopic.id,

			'institution-slug': slug(newTopic.institution.title),
			'publisher-slug': slug(newTopic.publisher.title),

			stage,
		},
	}

	return publisherClient.createTopic(topic)
}
