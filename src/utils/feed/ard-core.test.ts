import type { ArdFeed, ArdLivestream, ArdPublisher } from '#types'
import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { createSandbox } from 'sinon'
import { getPublisherById } from './ard-core.ts'
import { ardFeedClient, ardFeedRules, getARDFeed, resetArdFeed } from './ard-feed.ts'

const CURRENT_PUBLISHER_ID = 'urn:ard:publisher:d7b84d265c36f604'
const FORMER_REMAP_ID = 'urn:ard:publisher:d6ea740f7417ed56'

/**
 * Build a publisher stub with the given id and title.
 * @param id - Publisher URN
 * @param title - Station title
 * @returns Publisher stub
 */
const makePublisher = (id: string, title: string): ArdPublisher =>
	({
		id,
		title,
	}) as ArdPublisher

/**
 * Build a livestream stub carrying one publisher.
 * @param publisher - Publisher on the livestream
 * @returns Livestream stub
 */
const makeItem = (publisher: ArdPublisher): ArdLivestream =>
	({
		publisher,
	}) as ArdLivestream

test('getPublisherById matches the feed id and does not remap legacy publisher ids', async () => {
	const sandbox = createSandbox()
	sandbox.stub(ardFeedRules, 'minItems').value(1)
	sandbox.stub(ardFeedRules, 'maxItems').value(10)
	sandbox.stub(ardFeedRules, 'stations').value(['inforadio'])
	const publisher = makePublisher(CURRENT_PUBLISHER_ID, 'inforadio')
	const feed = {
		totalItemCount: 1,
		totalPageCount: 1,
		pageItemCount: 1,
		pageIndex: 0,
		generated: '2026-01-01T00:00:00Z',
		self: 'https://example.test/feed',
		items: [makeItem(publisher)],
	} satisfies ArdFeed
	sandbox.stub(ardFeedClient, 'fetch').resolves(
		new Response(JSON.stringify(feed), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		})
	)
	resetArdFeed()

	try {
		await getARDFeed()
		assertEquals(getPublisherById(CURRENT_PUBLISHER_ID)?.id, CURRENT_PUBLISHER_ID)
		assertEquals(getPublisherById(FORMER_REMAP_ID), undefined)
	} finally {
		sandbox.restore()
		resetArdFeed()
	}
})
