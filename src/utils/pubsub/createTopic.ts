import { DateTime } from 'luxon'
import slug from 'slug'
import config from '#config'
import publisherClient from './_publisherClient.ts'

type Topic = {
	name: string
	creator: string
	id: string
	institution: { title: string }
	publisher: { title: string }
}

export default async (newTopic: Topic) => {
	// create new topic
	const topic = {
		name: `projects/${process.env.GCP_PROJECT_ID}/topics/${newTopic.name}`,
		labels: {
			created: DateTime.now().toFormat('yyyy-LL-dd'),
			'creator-slug': slug(newTopic.creator),

			id: newTopic.id,

			'institution-slug': slug(newTopic.institution.title),
			'publisher-slug': slug(newTopic.publisher.title),

			stage: config.stage as string,
		},
	}

	return publisherClient.createTopic(topic)
}
