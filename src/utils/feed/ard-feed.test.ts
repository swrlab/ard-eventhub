import type { ArdFeed, ArdLivestream } from '#types'
import { test } from '@cross/test'
import { assertEquals, assertRejects, assertStrictEquals } from '@std/assert'
import { createSandbox } from 'sinon'
import {
	ArdFeedError,
	ardFeed,
	ardFeedClient,
	ardFeedRules,
	getARDFeed,
	getArdFeedValidationError,
	resetArdFeed,
} from './ard-feed.ts'

/**
 * Build a minimal livestream entry with the given publisher title.
 * @param title - Publisher title
 * @returns Minimal livestream stub
 */
const makeItem = (title: string): ArdLivestream =>
	({
		publisher: { title },
	}) as ArdLivestream

/**
 * Build a feed that passes validation under the current {@link ardFeedRules}.
 * @param overrides - Fields to merge onto the feed
 * @returns Valid feed fixture
 */
const makeValidFeed = (overrides: Partial<ArdFeed> = {}): ArdFeed => {
	const items = ardFeedRules.stations.map((title) => makeItem(title))
	while (items.length < ardFeedRules.minItems) {
		items.push(makeItem(`Station ${items.length}`))
	}

	return {
		totalItemCount: items.length,
		totalPageCount: 1,
		pageItemCount: items.length,
		pageIndex: 0,
		generated: '2026-01-01T00:00:00Z',
		self: 'https://example.test/feed',
		items,
		...overrides,
	}
}

/**
 * Stub fetch to return a JSON body with the given HTTP status.
 * @param body - Response JSON body
 * @param status - HTTP status code
 * @returns Sinon sandbox (caller must restore)
 */
const stubFetchJson = (body: unknown, status = 200) => {
	const sandbox = createSandbox()
	sandbox.stub(ardFeedClient, 'fetch').resolves(
		new Response(JSON.stringify(body), {
			status,
			headers: { 'content-type': 'application/json' },
		})
	)
	return sandbox
}

test('getArdFeedValidationError', async (t) => {
	await t.step('rejects a non-object payload', () => {
		assertStrictEquals(getArdFeedValidationError(null), 'Feed is not an array')
		assertStrictEquals(getArdFeedValidationError('nope'), 'Feed is not an array')
	})

	await t.step('rejects a payload without an items array', () => {
		assertStrictEquals(getArdFeedValidationError({}), 'Feed is not an array')
		assertStrictEquals(getArdFeedValidationError({ items: 'x' }), 'Feed is not an array')
	})

	await t.step('rejects an empty items array', () => {
		assertStrictEquals(getArdFeedValidationError({ items: [], totalPageCount: 1 }), 'Feed is empty')
	})

	await t.step('rejects feeds below the minimum item count', () => {
		const feed = makeValidFeed({ items: [makeItem('WDR 2')] })
		assertStrictEquals(getArdFeedValidationError(feed), 'pageItemCount is too small > 1')
	})

	await t.step('rejects feeds at or above the maximum item count', () => {
		const sandbox = createSandbox()
		sandbox.stub(ardFeedRules, 'minItems').value(1)
		sandbox.stub(ardFeedRules, 'maxItems').value(3)
		sandbox.stub(ardFeedRules, 'stations').value(['WDR 2'])
		try {
			const items = [makeItem('WDR 2'), makeItem('A'), makeItem('B')]
			assertStrictEquals(
				getArdFeedValidationError(makeValidFeed({ items, totalPageCount: 1 })),
				'pageItemCount is too high > 3'
			)
		} finally {
			sandbox.restore()
		}
	})

	await t.step('rejects paginated feeds', () => {
		const sandbox = createSandbox()
		sandbox.stub(ardFeedRules, 'minItems').value(1)
		sandbox.stub(ardFeedRules, 'stations').value(['WDR 2'])
		try {
			assertStrictEquals(
				getArdFeedValidationError(makeValidFeed({ items: [makeItem('WDR 2')], totalPageCount: 2 })),
				'Pagination is not supported'
			)
		} finally {
			sandbox.restore()
		}
	})

	await t.step('rejects feeds missing an expected station', () => {
		const sandbox = createSandbox()
		sandbox.stub(ardFeedRules, 'minItems').value(1)
		sandbox.stub(ardFeedRules, 'stations').value(['WDR 2', 'SWR3'])
		try {
			assertStrictEquals(
				getArdFeedValidationError(makeValidFeed({ items: [makeItem('WDR 2')], totalPageCount: 1 })),
				'🚨 SWR3 not found in ARD feed!'
			)
		} finally {
			sandbox.restore()
		}
	})

	await t.step('accepts a feed that satisfies the rules', () => {
		const sandbox = createSandbox()
		sandbox.stub(ardFeedRules, 'minItems').value(2)
		sandbox.stub(ardFeedRules, 'maxItems').value(10)
		sandbox.stub(ardFeedRules, 'stations').value(['WDR 2', 'SWR3'])
		try {
			assertStrictEquals(
				getArdFeedValidationError(
					makeValidFeed({
						items: [makeItem('WDR 2'), makeItem('SWR3')],
						totalPageCount: 1,
					})
				),
				null
			)
		} finally {
			sandbox.restore()
		}
	})
})

test('getARDFeed', async (t) => {
	await t.step('downloads, validates, caches, and returns the feed', async () => {
		const sandbox = createSandbox()
		sandbox.stub(ardFeedRules, 'minItems').value(2)
		sandbox.stub(ardFeedRules, 'maxItems').value(10)
		sandbox.stub(ardFeedRules, 'stations').value(['WDR 2', 'SWR3'])
		const feed = makeValidFeed({
			items: [makeItem('WDR 2'), makeItem('SWR3')],
			totalPageCount: 1,
		})
		sandbox.stub(ardFeedClient, 'fetch').resolves(
			new Response(JSON.stringify(feed), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			})
		)
		resetArdFeed()

		try {
			const result = await getARDFeed()
			assertEquals(result, feed)
			assertEquals(ardFeed, feed)
		} finally {
			sandbox.restore()
			resetArdFeed()
		}
	})

	await t.step('fails when the API returns a non-200 status', async () => {
		const sandbox = stubFetchJson({}, 503)
		sandbox.stub(ardFeedClient, 'fail').callsFake((message: string): never => {
			throw new ArdFeedError(message)
		})

		try {
			await assertRejects(() => getARDFeed(), ArdFeedError, 'API is not available (503)')
		} finally {
			sandbox.restore()
		}
	})

	await t.step('fails when validation rejects the payload', async () => {
		const sandbox = stubFetchJson({ items: [], totalPageCount: 1 })
		sandbox.stub(ardFeedClient, 'fail').callsFake((message: string): never => {
			throw new ArdFeedError(message)
		})

		try {
			await assertRejects(() => getARDFeed(), ArdFeedError, 'Feed is empty')
		} finally {
			sandbox.restore()
		}
	})

	await t.step('fails when fetch throws', async () => {
		const sandbox = createSandbox()
		sandbox.stub(ardFeedClient, 'fetch').rejects(new Error('network down'))
		sandbox.stub(ardFeedClient, 'fail').callsFake((message: string): never => {
			throw new ArdFeedError(message)
		})

		try {
			await assertRejects(() => getARDFeed(), ArdFeedError, 'Failed to download ARD feed')
		} finally {
			sandbox.restore()
		}
	})
})
