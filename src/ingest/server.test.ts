import process from 'node:process'
import { test } from '@cross/test'
import { DateTime } from '@frytg/dates'
import logger from '@frytg/logger'
import { assert, assertExists, assertGreater, assertStrictEquals } from '@std/assert'
import { app } from './server.ts'

/**
 * Log an error and exit the process when required test env is missing.
 * @param message - Error message to log
 */
const exitWithError = (message: string) => {
	logger.log({
		level: 'error',
		message,
		source: 'config',
	})
	process.exit(1)
}

// check required env vars
if (!process.env.TEST_USER) exitWithError('TEST_USER not found')
if (!process.env.TEST_USER_PW) exitWithError('TEST_USER_PW not found')

// set test-user env vars
const testUser = process.env.TEST_USER
const testUserPass = process.env.TEST_USER_PW
const testUserReset = process.env.TEST_USER_RESET

/** Parsed HTTP response for ingest tests. */
type TestResponse = {
	status: number
	statusCode: number
	body: any
	headers: Headers
}

/**
 * Perform an HTTP request against the Hono app.
 * @param method - HTTP method
 * @param path - Request path
 * @param options - Optional headers and JSON body
 * @returns Parsed response
 */
const request = async (
	method: string,
	path: string,
	options: { headers?: Record<string, string>; body?: unknown } = {}
): Promise<TestResponse> => {
	const headers = new Headers(options.headers)
	let body: string | undefined
	if (options.body !== undefined) {
		headers.set('content-type', 'application/json')
		body = JSON.stringify(options.body)
	}

	const res = await app.request(path, body === undefined ? { method, headers } : { method, headers, body })
	const text = await res.text()
	let parsed: any = text
	try {
		parsed = text ? JSON.parse(text) : null
	} catch {
		parsed = text
	}

	return {
		status: res.status,
		statusCode: res.status,
		body: parsed,
		headers: res.headers,
	}
}

/**
 * Assert a JSON response with the expected HTTP status.
 * @param res - App response
 * @param status - Expected status code
 */
function testResponse(res: TestResponse, status: number) {
	console.log(`comparing response with statusCode ${res.statusCode} (should be ${status})`)

	assert(isJson(res.body))
	assertStrictEquals(res.status, status)
}

/**
 * Check whether a value is JSON-serializable object data.
 * @param item - Value to inspect
 * @returns True when the value parses to a non-null object
 */
function isJson(item: any) {
	let value = typeof item === 'string' ? item : JSON.stringify(item)
	try {
		value = JSON.parse(value)
	} catch {
		return false
	}

	return typeof value === 'object' && value !== null
}

/**
 * Assert a failed auth response (403).
 * @param res - App response
 */
function testFailedAuth(res: TestResponse) {
	testResponse(res, 403)
}

/**
 * Assert a missing auth response (401).
 * @param res - App response
 */
function testMissingAuth(res: TestResponse) {
	assertStrictEquals(res.status, 401)
}

/*
	AUTH - Authentication services for Eventhub
*/

const loginPath = '/auth/login'
let accessToken = null as string | null
let refreshToken = null as string | null

/**
 * Assert auth response body shape.
 * @param body - Response body
 */
function testAuthKeys(body: any) {
	assert(isJson(body))
	assertExists(body.expiresIn)
	assertExists(body.expires)
	assertExists(body.token)
	assertExists(body.refreshToken)

	assertExists(body.user)
	assert(isJson(body.user))
	assertExists(body.user.user_id)
	assertExists(body.user.email_verified)
}

test(`POST ${loginPath}`, async () => {
	const loginRequest = {
		email: testUser,
		password: testUserPass,
	}

	const res = await request('POST', loginPath, { body: loginRequest })
	testResponse(res, 200)
	testAuthKeys(res.body)
	// Store tokens for further tests
	accessToken = res.body.token
	refreshToken = res.body.refreshToken
})

const refreshPath = '/auth/refresh'

test(`POST ${refreshPath}`, async () => {
	const refreshRequest = {
		refreshToken: refreshToken,
	}

	const res = await request('POST', refreshPath, { body: refreshRequest })
	testResponse(res, 200)
	testAuthKeys(res.body)

	// store new token for further tests
	accessToken = res.body.token
})

// 🚨 firebase limit is 150 requests per day 🚨
const resetPath = '/auth/reset'

if (testUserReset === 'true') {
	test(`POST ${resetPath}`, async () => {
		const resetRequest = {
			email: testUser,
		}

		const res = await request('POST', resetPath, { body: resetRequest })
		testResponse(res, 200)
	})
}

/*
	EVENTS - Manage events
*/

/**
 * Assert event publish response body shape.
 * @param body - Response body
 */
function testEventKeys(body: any) {
	isJson(body)
	assertExists(body.statuses)
	isJson(body.statuses)
	assertExists(body.event)
	isJson(body.event)
}

const eventName = 'de.ard.eventhub.v1.radio.track.playing'
const eventPath = `/events/${eventName}`

const event = {
	event: eventName,
	type: 'music',
	start: DateTime.now().toISO(),
	title: 'Unit Test Song',
	services: [
		{
			type: 'PermanentLivestream',
			externalId: 'crid://ard.de/28475/unit',
			publisherId: '28475',
		},
	],
	playlistItemId: 'unit-test-id-in-playlist-567',
	references: [
		{
			type: 'Show',
			externalId: 'crid://ard.de/my-show/1234567' as string | null,
			alternateIds: [
				'https://normdb.ivz.cn.ard.de/sendereihe/427',
				'urn:ard:show:027708befb6bfe14',
				'brid://br.de/broadcastSeries/1235',
			],
		},
		{
			type: 'Article',
			externalId: 'crid://dlf.de/article/1234567' as string | null,
			title: 'Kommerzielle US-Raumfahrt - Die neue Weltraumökonomie',
			url: 'https://www.deutschlandfunkkultur.de/kommerzielle-us-raumfahrt-die-neue-weltraumoekonomie-100.html',
		},
	],
}

test(`POST ${eventPath}`, async (t) => {
	await t.step('test missing auth for POST /event', async () => {
		const res = await request('POST', eventPath, { body: event })
		testMissingAuth(res)
	})

	await t.step('test invalid auth for POST /event', async () => {
		const res = await request('POST', eventPath, {
			headers: { Authorization: `Bearer invalid${accessToken}` },
			body: event,
		})
		testFailedAuth(res)
	})

	await t.step('publish a new event', async () => {
		const res = await request('POST', eventPath, {
			headers: { Authorization: `Bearer ${accessToken}` },
			body: event,
		})
		testResponse(res, 201)
		testEventKeys(res.body)
	})

	await t.step('publish a new event with expired time', async () => {
		event.start = DateTime.now().minus({ minutes: 20 }).toISO()
		const res = await request('POST', eventPath, {
			headers: { Authorization: `Bearer ${accessToken}` },
			body: event,
		})
		testResponse(res, 400)
	})

	await t.step('publish a new event with invalid time', async () => {
		event.start = `${DateTime.now().toISO()}00`
		const res = await request('POST', eventPath, {
			headers: { Authorization: `Bearer ${accessToken}` },
			body: event,
		})
		testResponse(res, 400)
	})

	await t.step('publish a new event with invalid externalId in references', async () => {
		// @ts-expect-error - we know that the object won't be null
		event.references[1].externalId = null
		const res = await request('POST', eventPath, {
			headers: { Authorization: `Bearer ${accessToken}` },
			body: event,
		})
		testResponse(res, 400)
	})

	await t.step('publish a new event with media including isFallback flag set to true', async () => {
		const eventWithFallbackMedia = {
			event: eventName,
			type: 'music',
			start: DateTime.now().toISO(),
			title: 'Unit Test Song with Fallback Media',
			services: [
				{
					type: 'PermanentLivestream',
					externalId: 'crid://ard.de/28475/unit',
					publisherId: '28475',
				},
			],
			playlistItemId: 'unit-test-id-in-playlist-567-fallback',
			media: [
				{
					type: 'cover',
					url: 'https://example.com/fallback-cover.jpg',
					templateUrl: null,
					description: 'Fallback Cover Image',
					attribution: null,
					isFallback: true,
				},
			],
		}
		const res = await request('POST', eventPath, {
			headers: { Authorization: `Bearer ${accessToken}` },
			body: eventWithFallbackMedia,
		})
		testResponse(res, 201)
		testEventKeys(res.body)
	})

	await t.step('publish a new event with media including isFallback flag set to false', async () => {
		const eventWithNonFallbackMedia = {
			event: eventName,
			type: 'music',
			start: DateTime.now().toISO(),
			title: 'Unit Test Song with Non-Fallback Media',
			services: [
				{
					type: 'PermanentLivestream',
					externalId: 'crid://ard.de/28475/unit',
					publisherId: '28475',
				},
			],
			playlistItemId: 'unit-test-id-in-playlist-567-non-fallback',
			media: [
				{
					type: 'cover',
					url: 'https://example.com/cover.jpg',
					templateUrl: null,
					description: 'Official Cover Image',
					attribution: 'Photographer XYZ',
					isFallback: false,
				},
			],
		}
		const res = await request('POST', eventPath, {
			headers: { Authorization: `Bearer ${accessToken}` },
			body: eventWithNonFallbackMedia,
		})
		testResponse(res, 201)
		testEventKeys(res.body)
	})

	await t.step('publish a new event with media without isFallback flag (should be optional)', async () => {
		const eventWithoutIsFallback = {
			event: eventName,
			type: 'music',
			start: DateTime.now().toISO(),
			title: 'Unit Test Song without isFallback',
			services: [
				{
					type: 'PermanentLivestream',
					externalId: 'crid://ard.de/28475/unit',
					publisherId: '28475',
				},
			],
			playlistItemId: 'unit-test-id-in-playlist-567-no-flag',
			media: [
				{
					type: 'cover',
					url: 'https://example.com/cover.jpg',
					templateUrl: null,
					description: 'Cover without isFallback field',
					attribution: null,
				},
			],
		}
		const res = await request('POST', eventPath, {
			headers: { Authorization: `Bearer ${accessToken}` },
			body: eventWithoutIsFallback,
		})
		testResponse(res, 201)
		testEventKeys(res.body)
	})

	await t.step('publish event with blocked service - common plugin should not be sent', async () => {
		const eventWithBlockedService = {
			event: eventName,
			type: 'music',
			start: DateTime.now().toISO(),
			title: 'Unit Test Song with Blocked Service',
			services: [
				{
					type: 'PermanentLivestream',
					externalId: 'crid://ard.de/999999/unit',
					publisherId: '999999', // invalid publisherId that will be blocked
				},
			],
			playlistItemId: 'unit-test-id-in-playlist-567-blocked',
		}
		const res = await request('POST', eventPath, {
			headers: { Authorization: `Bearer ${accessToken}` },
			body: eventWithBlockedService,
		})
		testResponse(res, 201)
		testEventKeys(res.body)

		// verify service is blocked
		assertGreater(res.body.statuses.blocked, 0)
		assert(res.body.event.services.some((s: any) => s.blocked))

		// verify common plugin is NOT sent when all services are blocked
		const commonPlugin = res.body.plugins.find((p: any) => p.type === 'common')
		assertStrictEquals(commonPlugin, undefined)
	})

	await t.step(
		'publish event with mixed blocked and non-blocked services - common plugin should only contain non-blocked services',
		async () => {
			const eventWithMixedServices = {
				event: eventName,
				type: 'music',
				start: DateTime.now().toISO(),
				title: 'Unit Test Song with Mixed Services',
				services: [
					{
						type: 'PermanentLivestream',
						externalId: 'crid://ard.de/28475/unit',
						publisherId: '28475', // valid publisherId
					},
					{
						type: 'PermanentLivestream',
						externalId: 'crid://ard.de/999999/unit',
						publisherId: '999999', // invalid publisherId that will be blocked
					},
				],
				playlistItemId: 'unit-test-id-in-playlist-567-mixed',
			}
			const res = await request('POST', eventPath, {
				headers: { Authorization: `Bearer ${accessToken}` },
				body: eventWithMixedServices,
			})
			testResponse(res, 201)
			testEventKeys(res.body)

			// verify some services are blocked
			assertGreater(res.body.statuses.blocked, 0)
			const blockedServices = res.body.event.services.filter((s: any) => s.blocked)
			const nonBlockedServices = res.body.event.services.filter((s: any) => !s.blocked)
			assertGreater(blockedServices.length, 0)
			assertGreater(nonBlockedServices.length, 0)

			// verify common plugin IS sent when there are non-blocked services
			const commonPlugin = res.body.plugins.find((p: any) => p.type === 'common')
			assertExists(commonPlugin)
			assertStrictEquals(commonPlugin.type, 'common')
			assertExists(commonPlugin.topic)
		}
	)

	await t.step('publish event with only non-blocked services - common plugin should be sent normally', async () => {
		const eventWithNonBlockedServices = {
			event: eventName,
			type: 'music',
			start: DateTime.now().toISO(),
			title: 'Unit Test Song with Non-Blocked Services',
			services: [
				{
					type: 'PermanentLivestream',
					externalId: 'crid://ard.de/28475/unit',
					publisherId: '28475', // valid publisherId
				},
			],
			playlistItemId: 'unit-test-id-in-playlist-567-non-blocked',
		}
		const res = await request('POST', eventPath, {
			headers: { Authorization: `Bearer ${accessToken}` },
			body: eventWithNonBlockedServices,
		})
		testResponse(res, 201)
		testEventKeys(res.body)

		// verify no services are blocked
		assertStrictEquals(res.body.statuses.blocked, 0)
		assert(res.body.event.services.every((s: any) => !s.blocked))

		// verify common plugin IS sent when there are non-blocked services
		const commonPlugin = res.body.plugins.find((p: any) => p.type === 'common')
		assertExists(commonPlugin)
		assertStrictEquals(commonPlugin.type, 'common')
		assertExists(commonPlugin.topic)
	})
})

const eventRadioTextName = 'de.ard.eventhub.v1.radio.text'
const eventRadioTextPath = `/events/${eventRadioTextName}`

const eventRadioText = {
	event: eventRadioTextName,
	start: DateTime.now().toISO(),
	validUntil: DateTime.now().toISO(),
	text: 'Unit Test Song',
	services: [
		{
			type: 'PermanentLivestream',
			externalId: 'crid://ard.de/28475/unit',
			publisherId: '28475',
		},
	],
}

test(`POST ${eventRadioTextPath}`, async (t) => {
	await t.step('test missing auth for POST /event', async () => {
		const res = await request('POST', eventRadioTextPath, { body: eventRadioText })
		testMissingAuth(res)
	})

	await t.step('test invalid auth for POST /event', async () => {
		const res = await request('POST', eventRadioTextPath, {
			headers: { Authorization: `Bearer invalid${accessToken}` },
			body: eventRadioText,
		})
		testFailedAuth(res)
	})

	await t.step('publish a new event', async () => {
		const res = await request('POST', eventRadioTextPath, {
			headers: { Authorization: `Bearer ${accessToken}` },
			body: eventRadioText,
		})
		testResponse(res, 201)
		testEventKeys(res.body)
	})

	await t.step('publish a new event with expired time', async () => {
		eventRadioText.start = DateTime.now().minus({ minutes: 20 }).toISO()
		const res = await request('POST', eventRadioTextPath, {
			headers: { Authorization: `Bearer ${accessToken}` },
			body: eventRadioText,
		})
		testResponse(res, 400)
	})

	await t.step('publish a new event with invalid time', async () => {
		eventRadioText.start = `${DateTime.now().toISO()}00`
		const res = await request('POST', eventRadioTextPath, {
			headers: { Authorization: `Bearer ${accessToken}` },
			body: eventRadioText,
		})
		testResponse(res, 400)
	})
})

/*
	TOPICS - Access to topics details
*/

const topicPath = '/topics'
let topicName: string

/**
 * Assert topic response body shape.
 * @param body - Response body
 */
function testTopicKeys(body: any) {
	isJson(body)

	assertExists(body.type)
	assertExists(body.id)
	assertExists(body.name)

	assertStrictEquals(typeof body.type, 'string')
	assertStrictEquals(typeof body.id, 'string')
	assertStrictEquals(typeof body.name, 'string')

	isJson(body.labels)
}

test(`GET ${topicPath}`, async (t) => {
	await t.step(`test auth for GET ${topicPath}`, async () => {
		const res = await request('GET', topicPath, {
			headers: { Authorization: `Bearer invalid${accessToken}` },
		})
		testFailedAuth(res)
	})

	await t.step('list all available topics', async () => {
		const res = await request('GET', topicPath, {
			headers: { Authorization: `Bearer ${accessToken}` },
		})
		testResponse(res, 200)
		assert(Array.isArray(res.body))
		res.body.every((i: any) => testTopicKeys(i))
		topicName = res.body[0].id
	})
})

/*
	SUBSCRIPTIONS - Access to subscription management
*/

const subscriptPath = '/subscriptions'
let subscriptionName: string

/**
 * Assert subscription response body shape.
 * @param body - Response body
 */
function testSubscriptionKeys(body: any) {
	isJson(body)

	assertExists(body.type)
	assertExists(body.method)
	assertExists(body.name)
	assertExists(body.path)

	assertStrictEquals(typeof body.type, 'string')
	assertStrictEquals(typeof body.method, 'string')
	assertStrictEquals(typeof body.name, 'string')
	assertStrictEquals(typeof body.path, 'string')

	isJson(body.topic)

	assertExists(body.topic.id)
	assertExists(body.topic.name)
	assertExists(body.topic.path)

	assertStrictEquals(typeof body.topic.id, 'string')
	assertStrictEquals(typeof body.topic.name, 'string')
	assertStrictEquals(typeof body.topic.path, 'string')

	assertExists(body.ackDeadlineSeconds)
	assertExists(body.serviceAccount)
	assertExists(body.url)
	assertExists(body.contact)
	assertExists(body.institutionId)

	assertStrictEquals(typeof body.ackDeadlineSeconds, 'number')
	assertStrictEquals(typeof body.serviceAccount, 'string')
	assertStrictEquals(typeof body.url, 'string')
	assertStrictEquals(typeof body.contact, 'string')
	assertStrictEquals(typeof body.institutionId, 'string')
}

test(`POST ${subscriptPath}`, async (t) => {
	const subscription = {
		type: 'PUBSUB',
		method: 'PUSH',
		url: 'https://ard.unit.test/eventhub/subscription',
		contact: 'eventhub-unit-test@ard.de',
		topic: topicName,
	}

	await t.step(`test auth for POST ${subscriptPath}`, async () => {
		const res = await request('POST', subscriptPath, {
			headers: { Authorization: `Bearer invalid${accessToken}` },
			body: subscription,
		})
		testFailedAuth(res)
	})

	await t.step('add a new subscription to this user', async () => {
		const res = await request('POST', subscriptPath, {
			headers: { Authorization: `Bearer ${accessToken}` },
			body: subscription,
		})
		testResponse(res, 201)
		testSubscriptionKeys(res.body)
		// Store subscription name for further tests
		subscriptionName = res.body.name
	})
})

test(`GET ${subscriptPath}`, async (t) => {
	await t.step(`test auth for GET ${subscriptPath}`, async () => {
		const res = await request('GET', subscriptPath, {
			headers: { Authorization: `Bearer invalid${accessToken}` },
		})
		testFailedAuth(res)
	})

	await t.step('list all subscriptions for this user', async () => {
		const res = await request('GET', subscriptPath, {
			headers: { Authorization: `Bearer ${accessToken}` },
		})
		testResponse(res, 200)
		res.body.every((i: any) => testSubscriptionKeys(i))
	})
})

test(`GET ${subscriptPath}/{name}`, async (t) => {
	await t.step(`test auth for GET ${subscriptPath}/{name}`, async () => {
		const res = await request('GET', `${subscriptPath}/${subscriptionName}`, {
			headers: { Authorization: `Bearer invalid${accessToken}` },
		})
		testFailedAuth(res)
	})

	await t.step('get details about single subscription from this user', async () => {
		const res = await request('GET', `${subscriptPath}/${subscriptionName}`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		})
		testResponse(res, 200)
		testSubscriptionKeys(res.body)
	})
})

test(`DELETE ${subscriptPath}/{name}`, async (t) => {
	await t.step(`test auth for DELETE ${subscriptPath}/{name}`, async () => {
		const res = await request('DELETE', `${subscriptPath}/${subscriptionName}`, {
			headers: { Authorization: `Bearer invalid${accessToken}` },
		})
		testFailedAuth(res)
	})

	await t.step('remove a single subscription by this user', async () => {
		const res = await request('DELETE', `${subscriptPath}/${subscriptionName}`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		})
		testResponse(res, 200)
		assertExists(res.body.valid)
		assertStrictEquals(res.body.valid, true)
	})
})
