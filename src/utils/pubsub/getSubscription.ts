/*

	ard-eventhub
	by SWR Audio Lab

*/

// load pubsub for internal queues
import pubSubClient from './_client'
import mapSubscription from './mapSubscription.ts'

// load config
import config from '../../../config'

export default async (name: string) => {
	// fetch subscription list
	const [subscription] = await pubSubClient.subscription(name).getMetadata()

	// filter subscriptions by prefix
	if (!subscription || subscription.name?.indexOf(config.pubSubPrefix) === -1)
		return Promise.reject(new Error(`subscription not found > ${name}`))

	// map and filter values
	const iSubscription = { metadata: null, ...subscription }
	const mappedSubscription = await mapSubscription(iSubscription)

	// return data
	return Promise.resolve(mappedSubscription)
}
