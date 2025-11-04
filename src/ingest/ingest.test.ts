/*

	ard-eventhub
	by SWR Audio Lab

	unit tests for the ingest service

*/

import { beforeAll, describe, expect, it } from '@jest/globals'
import { DateTime } from 'luxon'
import request, { type Response } from 'supertest'

import logger from '../utils/logger'
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
	it('swap login credentials for an id-token', (done) => {
		const loginRequest = {
			email: testUser,
			password: testUserPass,
		}

		request(server)
			.post(loginPath)
			.send(loginRequest)
			.end((_err, res) => {
				try {
					testResponse(res, 200)
					testAuthKeys(res.body)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
				// Store tokens for further tests
				accessToken = res.body.token
				refreshToken = res.body.refreshToken
			})
	})
})

const refreshPath = '/auth/refresh'

describe(`POST ${refreshPath}`, () => {
	it('swap refresh-token for new id-token', (done) => {
		const refreshRequest = {
			refreshToken: refreshToken,
		}

		request(server)
			.post(refreshPath)
			.send(refreshRequest)
			.end((_err, res) => {
				try {
					testResponse(res, 200)
					testAuthKeys(res.body)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}

				// store new token for further tests
				accessToken = res.body.token
			})
	})
})

// 🚨 firebase limit is 150 requests per day 🚨
const resetPath = '/auth/reset'

if (testUserReset === 'true') {
	describe(`POST ${resetPath}`, () => {
		it('request password reset email', (done) => {
			const resetRequest = {
				email: testUser,
			}

			request(server)
				.post(resetPath)
				.send(resetRequest)
				.end((_err, res) => {
					try {
						testResponse(res, 200)
					} catch (e: any) {
						done(e)
					}
					done()
				})
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
	it('test invalid auth for POST /event', (done) => {
		request(server)
			.post(eventPath)
			.send(event)
			.end((_err, res) => {
				try {
					testMissingAuth(res)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})

	it('test invalid auth for POST /event', (done) => {
		request(server)
			.post(eventPath)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.send(event)
			.end((_err, res) => {
				try {
					testFailedAuth(res)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})

	it('publish a new event', (done) => {
		request(server)
			.post(eventPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(event)
			.end((_err, res) => {
				try {
					testResponse(res, 201)
					testEventKeys(res.body)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})

	it('publish a new event with expired time', (done) => {
		event.start = DateTime.now().minus({ minutes: 3 }).toISO()
		request(server)
			.post(eventPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(event)
			.end((_err, res) => {
				try {
					testResponse(res, 400)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})

	it('publish a new event with invalid time', (done) => {
		event.start = `${DateTime.now().toISO()}00`
		request(server)
			.post(eventPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(event)
			.end((_err, res) => {
				try {
					testResponse(res, 400)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})

	it('publish a new event with invalid externalId in references', (done) => {
		event.references[1].externalId = null
		request(server)
			.post(eventPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(event)
			.end((_err, res) => {
				try {
					testResponse(res, 400)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
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
	it('test invalid auth for POST /event', (done) => {
		request(server)
			.post(eventRadioTextPath)
			.send(eventRadioText)
			.end((_err, res) => {
				try {
					testMissingAuth(res)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})

	it('test invalid auth for POST /event', (done) => {
		request(server)
			.post(eventRadioTextPath)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.send(eventRadioText)
			.end((_err, res) => {
				try {
					testFailedAuth(res)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})

	it('publish a new event', (done) => {
		request(server)
			.post(eventRadioTextPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(eventRadioText)
			.end((_err, res) => {
				try {
					testResponse(res, 201)
					testEventKeys(res.body)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})

	it('publish a new event with expired time', (done) => {
		eventRadioText.start = DateTime.now().minus({ minutes: 3 }).toISO()
		request(server)
			.post(eventRadioTextPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(eventRadioText)
			.end((_err, res) => {
				try {
					testResponse(res, 400)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})

	it('publish a new event with invalid time', (done) => {
		eventRadioText.start = `${DateTime.now().toISO()}00`
		request(server)
			.post(eventRadioTextPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(eventRadioText)
			.end((_err, res) => {
				try {
					testResponse(res, 400)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
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
	it(`test auth for GET ${topicPath}`, (done) => {
		request(server)
			.get(topicPath)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.end((_err, res) => {
				try {
					testFailedAuth(res)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})

	it('list all available topics', (done) => {
		request(server)
			.get(topicPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.end((_err, res) => {
				try {
					testResponse(res, 200)
					console.log(res.body)
					const isArray = Array.isArray(res.body)
					expect(isArray).toBeTruthy()
					res.body.every((i: any) => testTopicKeys(i))
					topicName = res.body[0].id
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
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

	beforeAll((done) => {
		subscription = {
			type: 'PUBSUB',
			method: 'PUSH',
			url: 'https://unit.test/eventhub/subscription',
			contact: 'eventhub-unit-test@ard.de',
			topic: topicName,
		}
		done()
	})

	it(`test auth for POST ${subscriptPath}`, (done) => {
		request(server)
			.post(subscriptPath)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.send(subscription)
			.end((_err, res) => {
				try {
					testFailedAuth(res)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})

	it('add a new subscription to this user', (done) => {
		request(server)
			.post(subscriptPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(subscription)
			.end((_err, res) => {
				try {
					testResponse(res, 201)
					testSubscriptionKeys(res.body)
					// Store subscription name for further tests
					subscriptionName = res.body.name
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})
})

describe(`GET ${subscriptPath}`, () => {
	it(`test auth for GET ${subscriptPath}`, (done) => {
		request(server)
			.get(subscriptPath)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.end((_err, res) => {
				try {
					testFailedAuth(res)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})

	it('list all subscriptions for this user', (done) => {
		request(server)
			.get(subscriptPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.end((_err, res) => {
				try {
					testResponse(res, 200)
					res.body.every((i: any) => testSubscriptionKeys(i))
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})
})

describe(`GET ${subscriptPath}/{name}`, () => {
	it(`test auth for GET ${subscriptPath}/{name}`, (done) => {
		request(server)
			.get(`${subscriptPath}/${subscriptionName}`)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.end((_err, res) => {
				try {
					testFailedAuth(res)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})

	it('get details about single subscription from this user', (done) => {
		request(server)
			.get(`${subscriptPath}/${subscriptionName}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.end((_err, res) => {
				try {
					testResponse(res, 200)
					testSubscriptionKeys(res.body)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})
})

describe(`DELETE ${subscriptPath}/{name}`, () => {
	it(`test auth for DELETE ${subscriptPath}/{name}`, (done) => {
		request(server)
			.delete(`${subscriptPath}/${subscriptionName}`)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.end((_err, res) => {
				try {
					testFailedAuth(res)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})

	it('remove a single subscription by this user', (done) => {
		request(server)
			.delete(`${subscriptPath}/${subscriptionName}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.end((_err, res) => {
				try {
					testResponse(res, 200)
					expect(res.body).toHaveProperty('valid')
					expect(res.body.valid).toBe(true)
					done()
				} catch (e: any) {
					console.error(e)
					done(e)
				}
			})
	})
})
