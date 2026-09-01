import { test } from '@cross/test'
import { logger } from '@frytg/logger'
import { assertEquals, assertStrictEquals } from '@std/assert'
import { Hono } from 'hono'
import { createSandbox } from 'sinon'
import { validateEventBody } from './validate.ts'

const eventName = 'de.ard.eventhub.v1.radio.track.playing'

const validBody = {
	event: eventName,
	type: 'music',
	start: '2026-01-01T12:00:00+01:00',
	length: 240,
	title: 'Unit Test Song',
	services: [
		{
			type: 'PermanentLivestream',
			externalId: 'crid://ard.de/28475/unit',
			publisherId: '28475',
		},
	],
	playlistItemId: 'unit-test-id-in-playlist-567',
}

/**
 * Build a tiny app that only runs event body validation.
 * @returns Hono app
 */
const makeApp = () => {
	const app = new Hono()
	app.post('/events/:eventName', validateEventBody, (c) => c.json({ ok: true }, 200))
	return app
}

test('validateEventBody logs Zod failures and returns 400', async () => {
	const sandbox = createSandbox()
	const warning = sandbox.stub(logger, 'warning')
	const app = makeApp()

	try {
		const res = await app.request(`/events/${eventName}`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: 'Bearer secret-token',
			},
			body: JSON.stringify({ start: 'not-a-timestamp' }),
		})

		assertStrictEquals(res.status, 400)
		assertStrictEquals(warning.calledOnce, true)

		const payload = warning.firstCall.args[0] as {
			message: string
			source: string
			data: {
				eventName: string
				body: unknown
				errors: unknown[]
				headers: Record<string, string>
			}
		}

		assertEquals(payload.message, 'event body failed Zod validation')
		assertEquals(payload.source, 'ingest/events/validate')
		assertEquals(payload.data.eventName, eventName)
		assertEquals(payload.data.body, { start: 'not-a-timestamp' })
		assertEquals(Array.isArray(payload.data.errors) && payload.data.errors.length > 0, true)
		assertEquals(payload.data.headers.authorization, 'hidden')
	} finally {
		sandbox.restore()
	}
})

test('validateEventBody does not log on success', async () => {
	const sandbox = createSandbox()
	const warning = sandbox.stub(logger, 'warning')
	const app = makeApp()

	try {
		const res = await app.request(`/events/${eventName}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(validBody),
		})

		assertStrictEquals(res.status, 200)
		assertStrictEquals(warning.called, false)
	} finally {
		sandbox.restore()
	}
})

const controlName = 'de.ard.eventhub.v1.radio.control'
const dataName = 'de.ard.eventhub.v1.radio.data'

const validControlBody = {
	event: controlName,
	start: '2026-05-27T16:03:00+01:00',
	name: 'TA',
	state: true,
	services: [
		{
			id: 'urn:ard:permanent-livestream:49267f7d67be180d',
			publisherId: 'urn:ard:publisher:75dbb3dace15f610',
			institutionId: 'urn:ard:institution:a3004ff924ece1a2',
		},
	],
}

const validDataBody = {
	event: dataName,
	start: '2020-01-19T06:00:00+01:00',
	cycle: 8,
	data: [{ type: 'radiotext', id: 0, value: 'Sie hören die ARD Popnacht' }],
	services: [
		{
			id: 'urn:ard:permanent-livestream:49267f7d67be180d',
			publisherId: 'urn:ard:publisher:75dbb3dace15f610',
			institutionId: 'urn:ard:institution:a3004ff924ece1a2',
		},
	],
}

/**
 * POST a JSON body and return status plus parsed payload.
 * @param name - URL event class
 * @param body - JSON body
 * @returns Status and body
 */
const postEvent = async (name: string, body: unknown) => {
	const app = makeApp()
	const res = await app.request(`/events/${name}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	})
	return { status: res.status, body: await res.json() }
}

test('validateEventBody rejects radio.control with a Connect payload', async () => {
	const res = await postEvent(controlName, validControlBody)
	assertStrictEquals(res.status, 400)
	assertEquals(res.body.message, 'event type is not accepted on the HTTPS API')
})

test('validateEventBody rejects radio.control with a track payload', async () => {
	const res = await postEvent(controlName, validBody)
	assertStrictEquals(res.status, 400)
	assertEquals(res.body.message, 'event type is not accepted on the HTTPS API')
})

test('validateEventBody rejects radio.data with a Connect payload', async () => {
	const res = await postEvent(dataName, validDataBody)
	assertStrictEquals(res.status, 400)
	assertEquals(res.body.message, 'event type is not accepted on the HTTPS API')
})

test('validateEventBody rejects radio.data with a track payload', async () => {
	const res = await postEvent(dataName, validBody)
	assertStrictEquals(res.status, 400)
	assertEquals(res.body.message, 'event type is not accepted on the HTTPS API')
})

test('validateEventBody rejects a Connect event name in the body on a track URL', async () => {
	const res = await postEvent(eventName, { ...validBody, event: controlName })
	assertStrictEquals(res.status, 400)
	assertEquals(res.body.message, 'event type is not accepted on the HTTPS API')
})
