/*

	ard-eventhub
	by SWR Audio Lab

	unit tests for the ingest service

*/

import { beforeAll, describe, expect, it } from 'bun:test'
import logger from '@frytg/logger'
import { DateTime } from 'luxon'
import request, { type Response } from 'supertest'

import { default as server } from './index'

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

// define general tests
function testResponse(res: Response, status: number) {
	console.log(`comparing response with statusCode ${res.statusCode} (should be ${status})`)

	expect(isJson(res)).toBe(true)
	expect(res.status).toBe(status)
}

function isJson(item: any) {
	let value = typeof item !== 'string' ? JSON.stringify(item) : item
	try {
		value = JSON.parse(value)
	} catch (_e) {
		return false
	}

	return typeof value === 'object' && value !== null
}

// check rejection of invalid token
function testFailedAuth(res: Response) {
	testResponse(res, 403)
}

function testMissingAuth(res: Response) {
	testResponse(res, 401)
}

/*
	AUTH - Authentication services for Eventhub
*/

const loginPath = '/auth/login'
let accessToken = null as string | null
let refreshToken = null as string | null

function testAuthKeys(body: any) {
	expect(isJson(body)).toBe(true)
	expect(body).toHaveProperty('expiresIn')
	//expect(body.expiresIn).toBeInstanceOf(Number)
	expect(body).toHaveProperty('expires')
	//expect(body.expires).toBeInstanceOf(String)
	expect(body).toHaveProperty('token')
	//expect(body.token).toBeInstanceOf(String)
	expect(body).toHaveProperty('refreshToken')
	//expect(body.refreshToken).toBeInstanceOf(String)

	expect(body).toHaveProperty('user')
	expect(isJson(body.user)).toBe(true)
	expect(body.user).toHaveProperty('user_id')
	//expect(body.user.user_id).toBeInstanceOf(String)
	expect(body.user).toHaveProperty('email_verified')
	//expect(body.user.email_verified).toBeInstanceOf(Boolean)
}

async function _login() {
	const loginRequest = {
		email: testUser,
		password: testUserPass,
	}

	const response = await request(server).post(loginPath).send(loginRequest)

	return response
}

//beforeAll((done) => {
//	 login().then(( res) => {
//		 // Store tokens for further tests
//		 accessToken = res.body.token
//		 refreshToken = res.body.refreshToken
//		 done()})
//})

describe(`POST ${loginPath}`, () => {
	it('swap login credentials for an id-token', async () => {
		const loginRequest = {
			email: testUser,
			password: testUserPass,
		}

		const res = await request(server).post(loginPath).send(loginRequest)
		testResponse(res, 200)
		testAuthKeys(res.body)
		// Store tokens for further tests
		accessToken = res.body.token
		refreshToken = res.body.refreshToken
	})
})

const refreshPath = '/auth/refresh'

describe(`POST ${refreshPath}`, () => {
	it('swap refresh-token for new id-token', async () => {
		const refreshRequest = {
			refreshToken: refreshToken,
		}

		const res = await request(server).post(refreshPath).send(refreshRequest)
		testResponse(res, 200)
		testAuthKeys(res.body)

		// store new token for further tests
		accessToken = res.body.token
	})
})

// 🚨 firebase limit is 150 requests per day 🚨
const resetPath = '/auth/reset'

if (testUserReset === 'true') {
	describe(`POST ${resetPath}`, () => {
		it('request password reset email', async () => {
			const resetRequest = {
				email: testUser,
			}

			const res = await request(server).post(resetPath).send(resetRequest)
			testResponse(res, 200)
		})
	})
}

/*
	EVENTS - Manage events
*/

function testEventKeys(body: any) {
	isJson(body)
	expect(body).toHaveProperty('statuses')
	isJson(body.statuses)
	expect(body).toHaveProperty('event')
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
			externalId: 'crid://swr.de/282310/unit',
			publisherId: '282310',
		},
	],
	playlistItemId: 'unit-test-id-in-playlist-567',
	references: [
		{
			type: 'Show',
			externalId: 'crid://swr.de/my-show/1234567' as string | null,
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

describe(`POST ${eventPath}`, () => {
	it('test invalid auth for POST /event', async () => {
		const res = await request(server).post(eventPath).send(event)
		testMissingAuth(res)
	})

	it('test invalid auth for POST /event', async () => {
		const res = await request(server).post(eventPath).set('Authorization', `Bearer invalid${accessToken}`).send(event)
		testFailedAuth(res)
	})

	it('publish a new event', async () => {
		const res = await request(server).post(eventPath).set('Authorization', `Bearer ${accessToken}`).send(event)
		testResponse(res, 201)
		testEventKeys(res.body)
	})

	it('publish a new event with expired time', async () => {
		event.start = DateTime.now().minus({ minutes: 20 }).toISO()
		const res = await request(server).post(eventPath).set('Authorization', `Bearer ${accessToken}`).send(event)
		testResponse(res, 400)
	})

	it('publish a new event with invalid time', async () => {
		event.start = `${DateTime.now().toISO()}00`
		const res = await request(server).post(eventPath).set('Authorization', `Bearer ${accessToken}`).send(event)
		testResponse(res, 400)
	})

	it('publish a new event with invalid externalId in references', async () => {
		event.references[1].externalId = null
		const res = await request(server).post(eventPath).set('Authorization', `Bearer ${accessToken}`).send(event)
		testResponse(res, 400)
	})

	it('publish a new event with media including isFallback flag set to true', async () => {
		const eventWithFallbackMedia = {
			event: eventName,
			type: 'music',
			start: DateTime.now().toISO(),
			title: 'Unit Test Song with Fallback Media',
			services: [
				{
					type: 'PermanentLivestream',
					externalId: 'crid://swr.de/282310/unit',
					publisherId: '282310',
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
		const res = await request(server).post(eventPath).set('Authorization', `Bearer ${accessToken}`).send(eventWithFallbackMedia)
		testResponse(res, 201)
		testEventKeys(res.body)
	})

	it('publish a new event with media including isFallback flag set to false', async () => {
		const eventWithNonFallbackMedia = {
			event: eventName,
			type: 'music',
			start: DateTime.now().toISO(),
			title: 'Unit Test Song with Non-Fallback Media',
			services: [
				{
					type: 'PermanentLivestream',
					externalId: 'crid://swr.de/282310/unit',
					publisherId: '282310',
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
		const res = await request(server).post(eventPath).set('Authorization', `Bearer ${accessToken}`).send(eventWithNonFallbackMedia)
		testResponse(res, 201)
		testEventKeys(res.body)
	})

	it('publish a new event with media without isFallback flag (should be optional)', async () => {
		const eventWithoutIsFallback = {
			event: eventName,
			type: 'music',
			start: DateTime.now().toISO(),
			title: 'Unit Test Song without isFallback',
			services: [
				{
					type: 'PermanentLivestream',
					externalId: 'crid://swr.de/282310/unit',
					publisherId: '282310',
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
		const res = await request(server).post(eventPath).set('Authorization', `Bearer ${accessToken}`).send(eventWithoutIsFallback)
		testResponse(res, 201)
		testEventKeys(res.body)
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
			externalId: 'crid://swr.de/282310/unit',
			publisherId: '282310',
		},
	],
}

describe(`POST ${eventRadioTextPath}`, () => {
	it('test invalid auth for POST /event', async () => {
		const res = await request(server).post(eventRadioTextPath).send(eventRadioText)
		testMissingAuth(res)
	})

	it('test invalid auth for POST /event', async () => {
		const res = await request(server)
			.post(eventRadioTextPath)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.send(eventRadioText)
		testFailedAuth(res)
	})

	it('publish a new event', async () => {
		const res = await request(server)
			.post(eventRadioTextPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(eventRadioText)
		testResponse(res, 201)
		testEventKeys(res.body)
	})

	it('publish a new event with expired time', async () => {
		eventRadioText.start = DateTime.now().minus({ minutes: 20 }).toISO()
		const res = await request(server)
			.post(eventRadioTextPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(eventRadioText)
		testResponse(res, 400)
	})

	it('publish a new event with invalid time', async () => {
		eventRadioText.start = `${DateTime.now().toISO()}00`
		const res = await request(server)
			.post(eventRadioTextPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(eventRadioText)
		testResponse(res, 400)
	})
})

/*
	TOPICS - Access to topics details
*/

const topicPath = '/topics'
let topicName: string

function testTopicKeys(body: any) {
	isJson(body)

	expect(body).toHaveProperty('type')
	expect(body).toHaveProperty('id')
	expect(body).toHaveProperty('name')

	expect(typeof body.type).toBe('string')
	expect(typeof body.id).toBe('string')
	expect(typeof body.name).toBe('string')

	isJson(body.labels)
}

describe(`GET ${topicPath}`, () => {
	it(`test auth for GET ${topicPath}`, async () => {
		const res = await request(server).get(topicPath).set('Authorization', `Bearer invalid${accessToken}`)
		testFailedAuth(res)
	})

	it('list all available topics', async () => {
		const res = await request(server).get(topicPath).set('Authorization', `Bearer ${accessToken}`)
		testResponse(res, 200)
		console.log(res.body)
		const isArray = Array.isArray(res.body)
		expect(isArray).toBeTruthy()
		res.body.every((i: any) => testTopicKeys(i))
		topicName = res.body[0].id
	})
})

/*
	SUBSCRIPTIONS - Access to subscription management
*/

const subscriptPath = '/subscriptions'
let subscriptionName: string

function testSubscriptionKeys(body: any) {
	isJson(body)

	expect(body).toHaveProperty('type')
	expect(body).toHaveProperty('method')
	expect(body).toHaveProperty('name')
	expect(body).toHaveProperty('path')

	expect(typeof body.type).toBe('string')
	expect(typeof body.method).toBe('string')
	expect(typeof body.name).toBe('string')
	expect(typeof body.path).toBe('string')

	isJson(body.topic)

	expect(body.topic).toHaveProperty('id')
	expect(body.topic).toHaveProperty('name')
	expect(body.topic).toHaveProperty('path')

	expect(typeof body.topic.id).toBe('string')
	expect(typeof body.topic.name).toBe('string')
	expect(typeof body.topic.path).toBe('string')

	expect(body).toHaveProperty('ackDeadlineSeconds')
	expect(body).toHaveProperty('serviceAccount')
	expect(body).toHaveProperty('url')
	expect(body).toHaveProperty('contact')
	expect(body).toHaveProperty('institutionId')

	expect(typeof body.ackDeadlineSeconds).toBe('number')
	expect(typeof body.serviceAccount).toBe('string')
	expect(typeof body.url).toBe('string')
	console.log(body.contact)
	expect(typeof body.contact).toBe('string')
	expect(typeof body.institutionId).toBe('string')
}

describe(`POST ${subscriptPath}`, () => {
	let subscription: any

	beforeAll(() => {
		subscription = {
			type: 'PUBSUB',
			method: 'PUSH',
			url: 'https://unit.test/eventhub/subscription',
			contact: 'eventhub-unit-test@ard.de',
			topic: topicName,
		}
	})

	it(`test auth for POST ${subscriptPath}`, async () => {
		const res = await request(server)
			.post(subscriptPath)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.send(subscription)
		testFailedAuth(res)
	})

	it('add a new subscription to this user', async () => {
		const res = await request(server)
			.post(subscriptPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(subscription)
		testResponse(res, 201)
		testSubscriptionKeys(res.body)
		// Store subscription name for further tests
		subscriptionName = res.body.name
	})
})

describe(`GET ${subscriptPath}`, () => {
	it(`test auth for GET ${subscriptPath}`, async () => {
		const res = await request(server).get(subscriptPath).set('Authorization', `Bearer invalid${accessToken}`)
		testFailedAuth(res)
	})

	it('list all subscriptions for this user', async () => {
		const res = await request(server).get(subscriptPath).set('Authorization', `Bearer ${accessToken}`)
		testResponse(res, 200)
		res.body.every((i: any) => testSubscriptionKeys(i))
	})
})

describe(`GET ${subscriptPath}/{name}`, () => {
	it(`test auth for GET ${subscriptPath}/{name}`, async () => {
		const res = await request(server)
			.get(`${subscriptPath}/${subscriptionName}`)
			.set('Authorization', `Bearer invalid${accessToken}`)
		testFailedAuth(res)
	})

	it('get details about single subscription from this user', async () => {
		const res = await request(server)
			.get(`${subscriptPath}/${subscriptionName}`)
			.set('Authorization', `Bearer ${accessToken}`)
		testResponse(res, 200)
		testSubscriptionKeys(res.body)
	})
})

describe(`DELETE ${subscriptPath}/{name}`, () => {
	it(`test auth for DELETE ${subscriptPath}/{name}`, async () => {
		const res = await request(server)
			.delete(`${subscriptPath}/${subscriptionName}`)
			.set('Authorization', `Bearer invalid${accessToken}`)
		testFailedAuth(res)
	})

	it('remove a single subscription by this user', async () => {
		const res = await request(server)
			.delete(`${subscriptPath}/${subscriptionName}`)
			.set('Authorization', `Bearer ${accessToken}`)
		testResponse(res, 200)
		expect(res.body).toHaveProperty('valid')
		expect(res.body.valid).toBe(true)
	})
})
