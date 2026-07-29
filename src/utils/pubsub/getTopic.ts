import { pubSubPrefix } from '#config'
import pubSubClient from './_client.ts'

export default async (topicName: string) => {
	// fetch topic list
	const [topic] = await pubSubClient.topic(topicName).get()

	// filter topics by prefix (stage)
	if (!topic?.name.includes(pubSubPrefix)) {
		throw new Error(`topic not found > ${topicName}`)
	}

	return topic
}
