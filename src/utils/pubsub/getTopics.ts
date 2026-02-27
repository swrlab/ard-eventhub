import { pubSubPrefix } from '#config'
import pubSubClient from './_client.ts'
import convertId from './convertId.ts'

export default async () => {
	const [allTopics] = await pubSubClient.getTopics()

	// filter topics by prefix (stage)
	const topics = allTopics.filter((topic) => topic.name.includes(pubSubPrefix))

	const mappedTopics = topics.map((topic) => {
		const name = topic.name.split('/').pop()

		if (!name) throw new Error('Topic name is required')

		return {
			type: 'PUBSUB',
			id: convertId.decode(name).replace(pubSubPrefix, ''),
			name,
			path: topic.name,
			labels: topic.metadata?.labels,
		}
	})

	return mappedTopics
}
