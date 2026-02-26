import config from '#config'
import pubSubClient from './_client.ts'
import mapSubscription from './mapSubscription.ts'

export default async () => {
	// fetch subscriptions list
	let [subscriptions] = await pubSubClient.getSubscriptions()

	// filter subscriptions by prefix (stage)
	subscriptions = subscriptions.filter((subscription) => subscription.name.includes(config.pubSubPrefix))

	// map and filter values
	const filteredSubscriptions = await Promise.all(
		subscriptions.map(async (subscription) => {
			const { limited } = await mapSubscription(subscription)
			return limited
		})
	)

	return filteredSubscriptions
}
