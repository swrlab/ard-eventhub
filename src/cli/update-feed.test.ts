import type { NatsConnection } from '@nats-io/transport-node'
import type { ArdFeedStore, FeedOutcome } from '#types'
import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { runUpdateFeed } from './update-feed.ts'

const stubStore = {} as ArdFeedStore
const stubNc = {} as NatsConnection

/**
 * Run {@link runUpdateFeed} with stubbed NATS and refresh steps.
 * @param outcome - Outcome returned by refresh
 * @returns Exit code and drain count
 */
const runWithOutcome = async (outcome: FeedOutcome): Promise<{ code: number; drained: number }> => {
	let drained = 0
	const code = await runUpdateFeed({
		connect: () => Promise.resolve(stubNc),
		drain: () => {
			drained += 1
			return Promise.resolve()
		},
		openStore: () => Promise.resolve(stubStore),
		refresh: () => Promise.resolve(outcome),
	})
	return { code, drained }
}

test('runUpdateFeed exits 0 on stored or unchanged and drains NATS', async () => {
	assertEquals(await runWithOutcome('stored'), { code: 0, drained: 1 })
	assertEquals(await runWithOutcome('unchanged'), { code: 0, drained: 1 })
})

test('runUpdateFeed exits 1 on rejected or unavailable and drains NATS', async () => {
	assertEquals(await runWithOutcome('rejected'), { code: 1, drained: 1 })
	assertEquals(await runWithOutcome('unavailable'), { code: 1, drained: 1 })
})

test('runUpdateFeed exits 1 when connect fails without draining', async () => {
	let drained = 0
	const code = await runUpdateFeed({
		connect: () => Promise.reject(new Error('ECONNREFUSED')),
		drain: () => {
			drained += 1
			return Promise.resolve()
		},
	})
	assertEquals(code, 1)
	assertEquals(drained, 0)
})

test('runUpdateFeed exits 1 when opening the store fails and still drains NATS', async () => {
	let drained = 0
	const code = await runUpdateFeed({
		connect: () => Promise.resolve(stubNc),
		drain: () => {
			drained += 1
			return Promise.resolve()
		},
		openStore: () => Promise.reject(new Error('permissions violation')),
	})
	assertEquals(code, 1)
	assertEquals(drained, 1)
})
