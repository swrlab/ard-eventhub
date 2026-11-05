import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { createPoller } from './use-poll.ts'

/**
 * A promise this test can resolve on demand, to control fetch resolution order.
 */
const deferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((res) => {
		resolve = res
	})
	return { promise, resolve }
}

/**
 * Minimal `Response` stub for a successful JSON reply.
 * @param body - Decoded JSON body
 * @returns Response-shaped object
 */
const jsonResponse = (body: unknown): Response =>
	({ ok: true, status: 200, json: async () => body }) as unknown as Response

test('createPoller commits the newest response even when an older request resolves later', async () => {
	const first = deferred<Response>()
	const second = deferred<Response>()
	const pending = [first.promise, second.promise]
	let callIndex = 0
	const originalFetch = globalThis.fetch

	globalThis.fetch = (() => pending[callIndex++]) as typeof fetch

	const poller = createPoller<{ value: string }>(() => '/api/test')

	try {
		const firstTick = poller.tick()
		const secondTick = poller.tick()

		// Out-of-order delivery: the newer request settles first, the stale one settles after.
		second.resolve(jsonResponse({ value: 'second' }))
		await secondTick
		first.resolve(jsonResponse({ value: 'first' }))
		await firstTick

		assertEquals(poller.data.value, { value: 'second' })
		assertEquals(poller.loading.value, false)
		assertEquals(poller.error.value, null)
	} finally {
		globalThis.fetch = originalFetch
	}
})

test('createPoller surfaces a non-ok response as an error without clearing stale data', async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = (async () => ({ ok: false, status: 503 }) as unknown as Response) as typeof fetch

	const poller = createPoller<{ value: string }>(() => '/api/test')

	try {
		await poller.tick()
		assertEquals(poller.error.value, '503')
		assertEquals(poller.loading.value, false)
	} finally {
		globalThis.fetch = originalFetch
	}
})

test('createPoller reports a transport failure through error', async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = (async () => {
		throw new Error('network down')
	}) as typeof fetch

	const poller = createPoller<{ value: string }>(() => '/api/test')

	try {
		await poller.tick()
		assertEquals(poller.error.value, 'network down')
	} finally {
		globalThis.fetch = originalFetch
	}
})
