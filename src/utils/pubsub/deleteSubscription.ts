/*

	ard-eventhub
	by SWR Audio Lab

*/

// load pubsub for internal queues
import pubSubClient from './_client'

export default async (name: string) => {
	// fetch topic list
	const [subscription] = await pubSubClient.subscription(name).delete()

	// return data
	return Promise.resolve(subscription)
}
