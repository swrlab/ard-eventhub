import type { Subscription } from '@google-cloud/pubsub'
import type { EventhubSubscriptionLimited } from '../../schemas/subscriptions.ts'
import { test } from '@cross/test'
import { logger } from '@frytg/logger'
import { assertEquals, assertStrictEquals } from '@std/assert'
import { createSandbox } from 'sinon'
import { pubSubPrefix } from '#config'
import { getSubscriptions } from './get-subscriptions.ts'

/**
 * Build a minimal subscription stub with the given short name.
 * @param name - Short subscription name
 * @returns Subscription stub
 */
const makeSubscription = (name: string) => ({ name: `projects/unit/subscriptions/${name}` }) as Subscription

test('getSubscriptions skips subscriptions that fail to map instead of rejecting', async () => {
	const sandbox = createSandbox()
	const warning = sandbox.stub(logger, 'warning')

	try {
		const subscriptions = [
			makeSubscription(`${pubSubPrefix}ok`),
			makeSubscription(`${pubSubPrefix}broken`),
			makeSubscription('other.stage.ignored'),
		]

		const result = await getSubscriptions({
			list: async () => subscriptions,
			map: async (subscription) => {
				if (subscription.name.endsWith('broken')) throw new Error('datastore timeout')
				return { limited: { name: subscription.name } as EventhubSubscriptionLimited }
			},
		})

		assertEquals(
			result.map((subscription) => subscription.name),
			[subscriptions[0]?.name]
		)
		assertStrictEquals(warning.callCount, 1)
	} finally {
		sandbox.restore()
	}
})
