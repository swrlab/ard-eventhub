/*

	ard-eventhub
	by SWR Audio Lab

*/

// load other utils
import pubSubClient from './_client'
import mapSubscription from './mapSubscription.ts'

// load config
import config from '../../../config'

export default async () => {
	// fetch subscriptions list
	let [subscriptions] = await pubSubClient.getSubscriptions()

	// filter subscriptions by prefix (stage)
	subscriptions = subscriptions.filter((subscription) => subscription.name.indexOf(config.pubSubPrefix) !== -1)

	// map and filter values
	const filteredSubscriptions = await Promise.all(
		subscriptions.map(async (subscription) => {
			const { limited } = await mapSubscription(subscription)
			return Promise.resolve(limited)
		})
	)

	// return data
	return Promise.resolve(filteredSubscriptions)
}
