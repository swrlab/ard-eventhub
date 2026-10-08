import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { natsUser } from '../env.ts'
import { app } from './server.ts'

test('stats routes answer without a websocket', async () => {
	const metaRes = await app.request('http://ui.test/api/meta')
	const filtered = await app.request('http://ui.test/api/rejections?institution=urn:ard:institution:abc')
	const missing = await app.request('http://ui.test/api/nope')
	assertEquals(metaRes.status, 200)
	assertEquals(metaRes.headers.get('cache-control'), 'no-store')
	const metaBody = await metaRes.json()
	assertEquals(metaBody.user, natsUser)
	assertEquals(JSON.stringify(metaBody).includes('password'), false)
	const rejections = await filtered.json()
	assertEquals(rejections.institution, 'urn:ard:institution:abc')
	assertEquals(missing.status, 404)
	const page = await app.request('http://ui.test/on-air')
	assertEquals(page.status, 200)
	const html = await page.text()
	assertEquals(html.includes('id="app"') || html.includes('just ui-build'), true)
	assertEquals((await app.request('http://ui.test/static/missing.js')).status, 404)
})

test('tail upgrade uses the server passed to fetch', async () => {
	let upgraded = false
	const ok = await app.request(
		'http://ui.test/api/tail?filter=radio.*.track.playing',
		{},
		{
			requestIP: () => ({ address: '10.1.2.3' }),
			upgrade: () => {
				upgraded = true
				return true
			},
		}
	)
	assertEquals(ok.status, 200)
	assertEquals(upgraded, true)
	const refused = await app.request('http://ui.test/api/tail', {}, { upgrade: () => false })
	assertEquals(refused.status, 400)
	assertEquals((await app.request('http://ui.test/api/tail')).status, 400)
	assertEquals((await app.request('http://ui.test/api/tail?filter=$SYS.>')).status, 400)
})
