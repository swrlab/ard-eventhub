import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { natsUser } from '../env.ts'
import { app } from './server.ts'

test('stats routes answer without a websocket', async () => {
	const metaRes = await app.request('http://ui.test/api/meta')
	const feedRes = await app.request('http://ui.test/api/feed')
	const filtered = await app.request('http://ui.test/api/rejections?institution=urn:ard:institution:abc')
	const missing = await app.request('http://ui.test/api/nope')
	assertEquals(metaRes.status, 200)
	assertEquals(metaRes.headers.get('cache-control'), 'no-store')
	const metaBody = await metaRes.json()
	assertEquals(metaBody.user, natsUser)
	assertEquals(String(metaBody.natsUrl).includes('@'), false)
	assertEquals(JSON.stringify(metaBody).includes('password'), false)
	assertEquals(feedRes.status, 200)
	const feedBody = await feedRes.json()
	assertEquals(feedBody.staleness, 'never')
	assertEquals(JSON.stringify(feedBody).includes('password'), false)
	const catalogRes = await app.request('http://ui.test/api/feed/catalog')
	assertEquals(catalogRes.status, 200)
	const catalog = await catalogRes.json()
	assertEquals(
		catalog.entries.some((entry: { overlay: boolean }) => entry.overlay),
		true
	)
	assertEquals(JSON.stringify(catalog).includes('password'), false)
	const rejections = await filtered.json()
	assertEquals(rejections.institution, 'urn:ard:institution:abc')
	assertEquals(missing.status, 404)
	const page = await app.request('http://ui.test/on-air')
	assertEquals(page.status, 200)
	const html = await page.text()
	assertEquals(html.includes('id="app"') || html.includes('just ui-build'), true)
	assertEquals((await app.request('http://ui.test/static/missing.js')).status, 404)
	const tail = await app.request('http://ui.test/api/tail')
	assertEquals(tail.status, 404)
	assertEquals(typeof metaBody.wsUrl, 'string')
	assertEquals(String(metaBody.wsUrl).startsWith('ws'), true)
})

test('update-feed is POST only and reports 503 without a NATS connection', async () => {
	const res = await app.request('http://ui.test/api/update-feed', { method: 'POST' })
	assertEquals(res.status, 503)
	assertEquals(res.headers.get('cache-control'), 'no-store')
	const body = await res.json()
	assertEquals(body.error, 'nats is unavailable')
	assertEquals((await app.request('http://ui.test/api/update-feed')).status, 404)
})
