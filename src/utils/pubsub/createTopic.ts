import { DateTime } from 'luxon'
import slug from 'slug'
import { projectId, stage } from '#env'
import type { EventhubTopicDatastore, ITopic } from '#types'
import publisherClient from './_publisherClient.ts'

export default async (newTopic: EventhubTopicDatastore & { id: string }) => {
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
