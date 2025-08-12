/*

	ard-eventhub
	by SWR Audio Lab

*/

// load pubsub for internal queues
import pubSubClient from './_client'

// load config
import config from '../../../config'

export default async (topicName: string) => {
	// fetch topic list
	const [topic] = await pubSubClient.topic(topicName).get()

	// filter topics by prefix (stage)
	if (!topic || topic.name.indexOf(config.pubSubPrefix) === -1)
		return Promise.reject(new Error(`topic not found > ${topicName}`))

	// return data
	return Promise.resolve(topic)
}
