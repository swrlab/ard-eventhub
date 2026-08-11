import { test } from '@cross/test'
import { assertEquals, assertStrictEquals } from '@std/assert'
import { Hono } from 'hono'
import { z } from 'zod'
import { JSON_BODY_LIMIT_BYTES, jsonBodyLimit } from './json-body-limit.ts'
import { zodValidate } from './zod-validate.ts'

const loginBody = z
	.object({
		email: z.string().optional(),
		password: z.string().optional(),
	})
	.strict()

/**
 * Build a minimal app mirroring unauthenticated auth routes with the JSON body limit.
 * @returns Hono app
 */
const makeApp = () => {
	const app = new Hono()
	app.use('*', jsonBodyLimit)
	app.post('/auth/login', zodValidate(loginBody), (c) => c.json({ ok: true }, 200))
	app.post('/auth/refresh', zodValidate(loginBody), (c) => c.json({ ok: true }, 200))
	app.post('/auth/reset', zodValidate(loginBody), (c) => c.json({ ok: true }, 200))
	return app
}

test('rejects oversized JSON bodies on unauthenticated auth routes with 413', async () => {
	const app = makeApp()
	const oversized = 'x'.repeat(JSON_BODY_LIMIT_BYTES + 1)
	const body = JSON.stringify({ email: `${oversized}@example.com`, password: 'secret' })

	assertEquals(body.length > JSON_BODY_LIMIT_BYTES, true)

	for (const path of ['/auth/login', '/auth/refresh', '/auth/reset'] as const) {
		const res = await app.request(path, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body,
		})

		assertStrictEquals(res.status, 413)
		assertEquals(await res.json(), {
			message: 'Payload Too Large',
			errors: [],
			trace: null,
		})
	}
})

test('allows JSON bodies under the 400kb limit past the size guard', async () => {
	const app = makeApp()
	const body = JSON.stringify({ email: 'user@example.com', password: 'secret' })
	assertEquals(body.length < JSON_BODY_LIMIT_BYTES, true)

	const res = await app.request('/auth/login', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body,
	})

	assertStrictEquals(res.status, 200)
	assertEquals(await res.json(), { ok: true })
})
