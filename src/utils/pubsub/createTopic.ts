/*

	ard-eventhub
	by SWR Audio Lab

*/

import { DateTime } from 'luxon'
// load node utils
import slug from 'slug'
import config from '../../../config'
// load pubsub for internal queues
import publisherClient from './_publisherClient'

export default async (newTopic: any) => {
	// create new topic
	const topic = {
		name: `projects/${process.env.GCP_PROJECT_ID}/topics/${newTopic.name}`,
		labels: {
			created: DateTime.now().toFormat('yyyy-LL-dd'),
			'creator-slug': slug(newTopic.creator),

			id: newTopic.id,

			'institution-slug': slug(newTopic.institution.title),
			'publisher-slug': slug(newTopic.publisher.title),

			stage: config.stage,
		},
	}

	return publisherClient.createTopic(topic)
}
