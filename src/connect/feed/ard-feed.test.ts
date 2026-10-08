import type { ArdFeed, ArdLivestream } from '#types'
import type { ArdFeedStore, FeedSnapshot } from './ard-feed.ts'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from '@cross/test'
import { assert, assertEquals } from '@std/assert'
import { createSandbox } from 'sinon'
import { ardFeedRules } from '../../utils/feed/ard-feed-rules.ts'
import { refreshArdFeed } from './ard-feed-loader.ts'
import {
	FEED_STALE_ALERT_MS,
	FEED_STALE_PAGE_MS,
	FEED_STALE_WARN_MS,
	applyKvSnapshot,
	connectedInstitutionIds,
	createArdFeedState,
	decideUpstream,
	feedGeneratedAt,
	feedReport,
	hydrateArdFeed,
	stalenessOf,
} from './ard-feed.ts'

/**
 * Minimal livestream with a publisher title and an institution id.
 * @param title - Publisher title
 * @param institutionId - Institution URN
 * @returns Livestream stub
 */
const makeItem = (title: string, institutionId: string): ArdLivestream => {
	const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '')
	return {
		id: `urn:ard:permanent-livestream:${slug}`,
		publisher: {
			id: `urn:ard:publisher:${slug}`,
			title,
			institution: { id: institutionId },
		},
	} as ArdLivestream
}

/**
 * Feed that passes the stubbed rules. Every item shares one institution unless a caller replaces one.
 * @param institutionId - Institution URN stamped on each item
 * @returns Valid feed
 */
const makeValidFeed = (institutionId = 'urn:ard:institution:house'): ArdFeed => {
	const items = ardFeedRules.stations.map((title) => makeItem(title, institutionId))
	while (items.length < ardFeedRules.minItems) {
		items.push(makeItem(`Station ${items.length}`, institutionId))
	}
	return {
		totalItemCount: items.length,
		totalPageCount: 1,
		pageItemCount: items.length,
		pageIndex: 0,
		generated: '2026-01-01T00:00:00.000Z',
		self: 'https://example.test/feed',
		items,
	}
}

/**
 * Copy a feed with a `generatedAt` stamp.
 * @param feed - Base feed
 * @param generatedAt - ISO timestamp
 * @returns Feed carrying that stamp
 */
const at = (feed: ArdFeed, generatedAt: string): ArdFeed => Object.assign({}, feed, { generatedAt })

/**
 * Run `fn` with the integrity rules narrowed so fixtures stay small.
 * @param fn - Test body
 */
const withRules = async (fn: () => Promise<void>): Promise<void> => {
	const sandbox = createSandbox()
	sandbox.stub(ardFeedRules, 'minItems').value(2)
	sandbox.stub(ardFeedRules, 'maxItems').value(20)
	sandbox.stub(ardFeedRules, 'stations').value(['WDR 2', 'SWR3'])
	try {
		await fn()
	} finally {
		sandbox.restore()
	}
}

/**
 * In-memory store. `writes` counts successful publishes.
 * @returns Store and a writes counter
 */
const memoryStore = (): { store: ArdFeedStore; writes: () => number } => {
	let current: FeedSnapshot | null = null
	let revision = 0
	let writes = 0
	const listeners: ((snapshot: FeedSnapshot) => void)[] = []
	const store: ArdFeedStore = {
		read: () => Promise.resolve(current),
		write: (feed) => {
			writes += 1
			revision += 1
			current = { feed, revision }
			for (const listener of listeners.slice()) listener(current)
			return Promise.resolve(current)
		},
		watch: (onSnapshot) => {
			listeners.push(onSnapshot)
			return () => {
				const index = listeners.indexOf(onSnapshot)
				if (index >= 0) listeners.splice(index, 1)
			}
		},
	}
	return { store, writes: () => writes }
}

test('decideUpstream keeps the previous feed when the candidate is bad', async () => {
	await withRules(async () => {
		const active = at(makeValidFeed(), '2026-06-01T00:00:00.000Z')
		const malformed = decideUpstream(active, { items: [] })
		assertEquals(malformed.action, 'keep')
		if (malformed.action === 'keep') assertEquals(malformed.successful, false)

		const dropped = makeValidFeed('urn:ard:institution:one')
		const activeTwo = makeValidFeed('urn:ard:institution:one')
		activeTwo.items[1] = makeItem('SWR3', 'urn:ard:institution:two')
		const fewer = decideUpstream(at(activeTwo, '2026-06-01T00:00:00.000Z'), at(dropped, '2026-06-02T00:00:00.000Z'))
		assertEquals(fewer.action, 'keep')
		if (fewer.action === 'keep') assertEquals(fewer.reason.startsWith('institution count dropped'), true)

		const connected = new Set(['urn:ard:institution:two'])
		const missing = decideUpstream(
			at(activeTwo, '2026-06-01T00:00:00.000Z'),
			at(makeValidFeed('urn:ard:institution:one'), '2026-06-02T00:00:00.000Z'),
			connected
		)
		assertEquals(missing.action, 'keep')
		if (missing.action === 'keep') assertEquals(missing.reason.includes('urn:ard:institution:two'), true)

		const older = decideUpstream(
			at(active, '2026-06-02T00:00:00.000Z'),
			at(makeValidFeed(), '2026-06-01T00:00:00.000Z')
		)
		assertEquals(older.action, 'keep')
		if (older.action === 'keep') {
			assertEquals(older.successful, true)
			assertEquals(older.reason, 'generated is not newer')
		}
	})
})

test('decideUpstream stores a newer valid feed', async () => {
	await withRules(async () => {
		const active = at(makeValidFeed(), '2026-06-01T00:00:00.000Z')
		const next = at(makeValidFeed(), '2026-06-02T00:00:00.000Z')
		const decision = decideUpstream(active, next, new Set(['urn:ard:institution:house']))
		assertEquals(decision.action, 'store')
		const cold = decideUpstream(null, next)
		assertEquals(cold.action, 'store')
	})
})

test('connectedInstitutionIds uses the institutions on a connected username', () => {
	const ids = connectedInstitutionIds(
		[
			{ username: 'pub-house', institutions: ['urn:ard:institution:house'] },
			{ username: 'svc-sidecar', institutions: [] },
		],
		[{ user: 'pub-house' }, { user: 'svc-sidecar' }, { user: '' }]
	)
	assertEquals([...ids], ['urn:ard:institution:house'])
})

test('staleness follows the last successful fetch', () => {
	const start = Date.parse('2026-06-01T00:00:00.000Z')
	assertEquals(stalenessOf(null, start), 'never')
	assertEquals(stalenessOf(new Date(start).toISOString(), start + FEED_STALE_WARN_MS - 1), 'ok')
	assertEquals(stalenessOf(new Date(start).toISOString(), start + FEED_STALE_WARN_MS), 'warn')
	assertEquals(stalenessOf(new Date(start).toISOString(), start + FEED_STALE_ALERT_MS), 'alert')
	assertEquals(stalenessOf(new Date(start).toISOString(), start + FEED_STALE_PAGE_MS), 'page')
})

test('refresh keeps the serving feed when the fetch fails or the candidate is rejected', async () => {
	await withRules(async () => {
		const dir = await mkdtemp(join(tmpdir(), 'ard-feed-'))
		try {
			const active = at(makeValidFeed(), '2026-06-02T00:00:00.000Z')
			const state = createArdFeedState()
			state.feed = active
			state.lastSuccessAt = '2026-06-02T01:00:00.000Z'
			const { store, writes } = memoryStore()
			const diskPath = join(dir, 'feed.json')

			await refreshArdFeed(state, {
				store,
				url: 'https://example.test/feed',
				diskPath,
				fetchFeed: () => Promise.reject(new Error('connect ECONNREFUSED')),
				now: () => new Date('2026-06-02T02:00:00.000Z'),
			})
			assertEquals(state.feed, active)
			assertEquals(state.lastSuccessAt, '2026-06-02T01:00:00.000Z')
			assertEquals(state.outcome, 'unavailable')
			assertEquals(writes(), 0)

			await refreshArdFeed(state, {
				store,
				url: 'https://example.test/feed',
				diskPath,
				fetchFeed: () => Promise.resolve({ items: [] }),
				now: () => new Date('2026-06-02T02:00:00.000Z'),
			})
			assertEquals(state.feed, active)
			assertEquals(state.outcome, 'rejected')
			assertEquals(writes(), 0)

			await refreshArdFeed(state, {
				store,
				url: 'https://example.test/feed',
				diskPath,
				fetchFeed: () => Promise.resolve(at(makeValidFeed(), '2026-06-01T00:00:00.000Z')),
				now: () => new Date('2026-06-02T03:00:00.000Z'),
			})
			assertEquals(state.feed, active)
			assertEquals(state.outcome, 'unchanged')
			assertEquals(state.lastSuccessAt, '2026-06-02T03:00:00.000Z')
			assertEquals(state.lastError, null)
			assertEquals(writes(), 0)
		} finally {
			await rm(dir, { recursive: true, force: true })
		}
	})
})

test('refresh stores a newer feed and a KV failure leaves the previous one', async () => {
	await withRules(async () => {
		const dir = await mkdtemp(join(tmpdir(), 'ard-feed-'))
		try {
			const state = createArdFeedState()
			state.feed = at(makeValidFeed(), '2026-06-01T00:00:00.000Z')
			const diskPath = join(dir, 'feed.json')
			const failing: ArdFeedStore = {
				read: () => Promise.resolve(null),
				write: () => Promise.reject(new Error('permissions violation')),
				watch: () => () => undefined,
			}
			await refreshArdFeed(state, {
				store: failing,
				url: 'https://example.test/feed',
				diskPath,
				fetchFeed: () => Promise.resolve(at(makeValidFeed(), '2026-06-02T00:00:00.000Z')),
			})
			assertEquals(feedGeneratedAt(state.feed!), '2026-06-01T00:00:00.000Z')
			assertEquals(state.outcome, 'unavailable')
			assertEquals(state.lastSuccessAt, null)

			const { store } = memoryStore()
			await refreshArdFeed(state, {
				store,
				url: 'https://example.test/feed',
				diskPath,
				fetchFeed: () => Promise.resolve(at(makeValidFeed(), '2026-06-02T00:00:00.000Z')),
				now: () => new Date('2026-06-02T04:00:00.000Z'),
			})
			assertEquals(state.outcome, 'stored')
			assertEquals(state.source, 'kv')
			assertEquals(state.revision, 1)
			assertEquals(feedGeneratedAt(state.feed!), '2026-06-02T00:00:00.000Z')
			assertEquals(state.lastSuccessAt, '2026-06-02T04:00:00.000Z')
			const cached = JSON.parse(await readFile(diskPath, 'utf8')) as { generatedAt: string }
			assertEquals(cached.generatedAt, '2026-06-02T00:00:00.000Z')
		} finally {
			await rm(dir, { recursive: true, force: true })
		}
	})
})

test('hydrate and a KV watch swap without a restart', async () => {
	await withRules(async () => {
		const dir = await mkdtemp(join(tmpdir(), 'ard-feed-'))
		try {
			const diskPath = join(dir, 'feed.json')
			const cached = at(makeValidFeed(), '2026-05-01T00:00:00.000Z')
			await writeFile(diskPath, JSON.stringify(cached))

			const state = createArdFeedState()
			await hydrateArdFeed(state, {
				readKv: () => Promise.reject(new Error('no responders')),
				diskPath,
			})
			assertEquals(state.source, 'disk')
			assertEquals(feedGeneratedAt(state.feed!), '2026-05-01T00:00:00.000Z')

			const newer = at(makeValidFeed(), '2026-06-01T00:00:00.000Z')
			assertEquals(applyKvSnapshot(state, { feed: { items: [] } as unknown as ArdFeed, revision: 4 }), false)
			assertEquals(state.source, 'disk')
			assertEquals(applyKvSnapshot(state, { feed: newer, revision: 4 }), true)
			assertEquals(state.revision, 4)
			assertEquals(state.source, 'kv')
			assertEquals(applyKvSnapshot(state, { feed: newer, revision: 4 }), false)

			const report = feedReport(state, Date.parse('2026-06-01T01:00:00.000Z'))
			assertEquals(report.revision, 4)
			assertEquals(report.itemCount, newer.items.length)
			assertEquals(report.staleness, 'never')
			assert(report.ageMs === 60 * 60 * 1000)
		} finally {
			await rm(dir, { recursive: true, force: true })
		}
	})
})
