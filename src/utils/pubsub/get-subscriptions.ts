import type { Subscription } from '@google-cloud/pubsub'
import type { EventhubSubscriptionLimited } from '../../schemas/subscriptions.ts'
import { logger } from '@frytg/logger'
import { pubSubPrefix } from '#config'
import { pubSubClient } from './_client.ts'
import { mapSubscription } from './map-subscription.ts'

const source = 'utils/pubsub/getSubscriptions'

type GetSubscriptionsDeps = {
	list: () => Promise<Subscription[]>
	map: (subscription: Subscription) => Promise<{ limited: EventhubSubscriptionLimited }>
}

const defaultDeps: GetSubscriptionsDeps = {
	list: async () => {
		const [subscriptions] = await pubSubClient.getSubscriptions()
		return subscriptions
	},
	map: mapSubscription,
}

/**
 * Load all subscriptions of the current stage and map them to the limited format.
 * Subscriptions that fail to map are logged and skipped, so one broken entry doesn't fail the whole list.
 * @param deps - Injectable Pub/Sub list and map functions (for tests)
 * @returns Mapped subscriptions
 */
export const getSubscriptions = async (deps: GetSubscriptionsDeps = defaultDeps) => {
	// fetch subscriptions list and filter by prefix (stage)
	const subscriptions = (await deps.list()).filter((subscription) => subscription.name.includes(pubSubPrefix))

	// map values, keeping successful ones
	const results = await Promise.allSettled(subscriptions.map((subscription) => deps.map(subscription)))

	const mapped: EventhubSubscriptionLimited[] = []
	results.forEach((result, index) => {
		if (result.status === 'fulfilled') {
			mapped.push(result.value.limited)
			return
		}

		logger.warning({
			message: 'failed to map subscription, skipping',
			source,
			data: { subscriptionName: subscriptions[index]?.name },
			error: result.reason,
		})
	})

	return mapped
}
