import { pubSubPrefix } from '#config'
import pubSubClient from './_client.ts'
import mapSubscription from './mapSubscription.ts'

export default async (name: string) => {
	// fetch subscription list
	const [subscription] = await pubSubClient.subscription(name).getMetadata()

	// filter subscriptions by prefix
	if (!subscription?.name?.includes(pubSubPrefix)) throw new Error(`subscription not found > ${name}`)

	// map and filter values
	const mappedSubscription = await mapSubscription(subscription)
	return mappedSubscription
}
