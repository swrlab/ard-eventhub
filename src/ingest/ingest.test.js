/*

	ard-eventhub
	by SWR Audio Lab

	unit tests for the ingest service

*/

// Require dependencies
const { describe, it, before } = require('mocha')
const chai = require('chai')
const chaiHttp = require('chai-http')
const { DateTime } = require('luxon')

const server = require('./index')
const logger = require('../utils/logger')

// Init chai functions
const { expect } = chai
chai.should()

// Use chaiHttp
chai.use(chaiHttp)

const exitWithError = (message) => {
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
function testResponse(res, status) {
	console.log(`comparing response with statusCode ${res.statusCode} (should be ${status})`)
	expect(res).to.be.json
	expect(res).to.have.status(status)
}

// check rejection of invalid token
function testFailedAuth(res) {
	testResponse(res, 403)
}
function testMissingAuth(res) {
	testResponse(res, 401)
}

/*
	AUTH - Authentication services for Eventhub
*/

const loginPath = '/auth/login'
let accessToken = null
let refreshToken = null

function testAuthKeys(body) {
	body.should.be.a('object')
	body.should.have.property('expiresIn').to.be.a('number')
	body.should.have.property('expires').to.be.a('string')
	body.should.have.property('token').to.be.a('string')
	body.should.have.property('refreshToken').to.be.a('string')
	body.should.have.property('user').to.be.a('object')
	body.user.should.have.property('user_id').to.be.a('string')
	body.user.should.have.property('email_verified').to.be.a('boolean')
}

describe(`POST ${loginPath}`, () => {
	it('swap login credentials for an id-token', (done) => {
		const loginRequest = {
			email: testUser,
			password: testUserPass,
		}

		chai
			.request(server)
			.post(loginPath)
			.send(loginRequest)
			.end((_err, res) => {
				testResponse(res, 200)
				testAuthKeys(res.body)
				done()
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

		chai
			.request(server)
			.post(refreshPath)
			.send(refreshRequest)
			.end((_err, res) => {
				testResponse(res, 200)
				testAuthKeys(res.body)
				done()

				// store new token for further tests
				accessToken = res.body.token
			})
	})
})

// 🚨 firebase limit is 150 requests per day 🚨
const resetPath = '/auth/reset'

if (testUserReset === true) {
	describe(`POST ${resetPath}`, () => {
		it('request password reset email', (done) => {
			const resetRequest = {
				email: testUser,
			}

			chai
				.request(server)
				.post(resetPath)
				.send(resetRequest)
				.end((_err, res) => {
					testResponse(res, 200)
					done()
				})
		})
	})
}

/*
	EVENTS - Manage events
*/

function testEventKeys(body) {
	body.should.be.a('object')
	body.should.have.property('statuses').to.be.a('object')
	body.should.have.property('event').to.be.a('object')
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
			externalId: 'crid://swr.de/my-show/1234567',
			alternateIds: [
				'https://normdb.ivz.cn.ard.de/sendereihe/427',
				'urn:ard:show:027708befb6bfe14',
				'brid://br.de/broadcastSeries/1235',
			],
		},
		{
			type: 'Article',
			externalId: 'crid://dlf.de/article/1234567',
			title: 'Kommerzielle US-Raumfahrt - Die neue Weltraumökonomie',
			url: 'https://www.deutschlandfunkkultur.de/kommerzielle-us-raumfahrt-die-neue-weltraumoekonomie-100.html',
		},
	],
}

describe(`POST ${eventPath}`, () => {
	it('test invalid auth for POST /event', (done) => {
		chai
			.request(server)
			.post(eventPath)
			.send(event)
			.end((_err, res) => {
				testMissingAuth(res)
				done()
			})
	})

	it('test invalid auth for POST /event', (done) => {
		chai
			.request(server)
			.post(eventPath)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.send(event)
			.end((_err, res) => {
				testFailedAuth(res)
				done()
			})
	})

	it('publish a new event', (done) => {
		chai
			.request(server)
			.post(eventPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(event)
			.end((_err, res) => {
				testResponse(res, 201)
				testEventKeys(res.body)
				done()
			})
	})

	it('publish a new event with expired time', (done) => {
		event.start = DateTime.now().minus({ minutes: 3 }).toISO()
		chai
			.request(server)
			.post(eventPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(event)
			.end((_err, res) => {
				testResponse(res, 400)
				done()
			})
	})

	it('publish a new event with invalid time', (done) => {
		event.start = `${DateTime.now().toISO()}00`
		chai
			.request(server)
			.post(eventPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(event)
			.end((_err, res) => {
				testResponse(res, 400)
				done()
			})
	})

	it('publish a new event with invalid externalId in references', (done) => {
		event.references[1].externalId = null
		chai
			.request(server)
			.post(eventPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(event)
			.end((_err, res) => {
				testResponse(res, 400)
				done()
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
		chai
			.request(server)
			.post(eventRadioTextPath)
			.send(eventRadioText)
			.end((_err, res) => {
				testMissingAuth(res)
				done()
			})
	})

	it('test invalid auth for POST /event', (done) => {
		chai
			.request(server)
			.post(eventRadioTextPath)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.send(eventRadioText)
			.end((_err, res) => {
				testFailedAuth(res)
				done()
			})
	})

	it('publish a new event', (done) => {
		chai
			.request(server)
			.post(eventRadioTextPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(eventRadioText)
			.end((_err, res) => {
				testResponse(res, 201)
				testEventKeys(res.body)
				done()
			})
	})

	it('publish a new event with expired time', (done) => {
		eventRadioText.start = DateTime.now().minus({ minutes: 3 }).toISO()
		chai
			.request(server)
			.post(eventRadioTextPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(eventRadioText)
			.end((_err, res) => {
				testResponse(res, 400)
				done()
			})
	})

	it('publish a new event with invalid time', (done) => {
		eventRadioText.start = `${DateTime.now().toISO()}00`
		chai
			.request(server)
			.post(eventRadioTextPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(eventRadioText)
			.end((_err, res) => {
				testResponse(res, 400)
				done()
			})
	})
})

/*
	TOPICS - Access to topics details
*/

const topicPath = '/topics'
let topicName

function testTopicKeys(body) {
	body.should.be.a('object')
	body.should.have.property('type').to.be.a('string')
	body.should.have.property('id').to.be.a('string')
	body.should.have.property('name').to.be.a('string')
	body.should.have.property('labels').to.be.a('object')
}

describe(`GET ${topicPath}`, () => {
	it(`test auth for GET ${topicPath}`, (done) => {
		chai
			.request(server)
			.get(topicPath)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.end((_err, res) => {
				testFailedAuth(res)
				done()
			})
	})

	it('list all available topics', (done) => {
		chai
			.request(server)
			.get(topicPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.end((_err, res) => {
				testResponse(res, 200)
				res.body.should.be.a('array')
				res.body.every((i) => testTopicKeys(i))
				topicName = res.body[0].id
				done()
			})
	})
})

/*
	SUBSCRIPTIONS - Access to subscription management
*/

const subscriptPath = '/subscriptions'
let subscriptionName

function testSubscriptionKeys(body) {
	body.should.be.a('object')
	body.should.have.property('type').to.be.a('string')
	body.should.have.property('method').to.be.a('string')
	body.should.have.property('name').to.be.a('string')
	body.should.have.property('path').to.be.a('string')
	body.should.have.property('topic').to.be.a('object')
	body.topic.should.have.property('id').to.be.a('string')
	body.topic.should.have.property('name').to.be.a('string')
	body.topic.should.have.property('path').to.be.a('string')
	body.should.have.property('ackDeadlineSeconds').to.be.a('number')
	body.should.have.property('serviceAccount').to.be.a('string')
	body.should.have.property('url').to.be.a('string')
	body.should.have.property('contact').to.be.a('string')
	body.should.have.property('institutionId').to.be.a('string')
}

describe(`POST ${subscriptPath}`, () => {
	let subscription

	before((done) => {
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
		chai
			.request(server)
			.post(subscriptPath)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.send(subscription)
			.end((_err, res) => {
				testFailedAuth(res)
				done()
			})
	})

	it('add a new subscription to this user', (done) => {
		chai
			.request(server)
			.post(subscriptPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.send(subscription)
			.end((_err, res) => {
				testResponse(res, 201)
				testSubscriptionKeys(res.body)
				// Store subscription name for further tests
				subscriptionName = res.body.name
				done()
			})
	})
})

describe(`GET ${subscriptPath}`, () => {
	it(`test auth for GET ${subscriptPath}`, (done) => {
		chai
			.request(server)
			.get(subscriptPath)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.end((_err, res) => {
				testFailedAuth(res)
				done()
			})
	})

	it('list all subscriptions for this user', (done) => {
		chai
			.request(server)
			.get(subscriptPath)
			.set('Authorization', `Bearer ${accessToken}`)
			.end((_err, res) => {
				testResponse(res, 200)
				res.body.should.be.a('array')
				res.body.every((i) => testSubscriptionKeys(i))
				done()
			})
	})
})

describe(`GET ${subscriptPath}/{name}`, () => {
	it(`test auth for GET ${subscriptPath}/{name}`, (done) => {
		chai
			.request(server)
			.get(`${subscriptPath}/${subscriptionName}`)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.end((_err, res) => {
				testFailedAuth(res)
				done()
			})
	})

	it('get details about single subscription from this user', (done) => {
		chai
			.request(server)
			.get(`${subscriptPath}/${subscriptionName}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.end((_err, res) => {
				testResponse(res, 200)
				testSubscriptionKeys(res.body)
				done()
			})
	})
})

describe(`DELETE ${subscriptPath}/{name}`, () => {
	it(`test auth for DELETE ${subscriptPath}/{name}`, (done) => {
		chai
			.request(server)
			.delete(`${subscriptPath}/${subscriptionName}`)
			.set('Authorization', `Bearer invalid${accessToken}`)
			.end((_err, res) => {
				testFailedAuth(res)
				done()
			})
	})

	it('remove a single subscription by this user', (done) => {
		chai
			.request(server)
			.delete(`${subscriptPath}/${subscriptionName}`)
			.set('Authorization', `Bearer ${accessToken}`)
			.end((_err, res) => {
				testResponse(res, 200)
				res.body.should.be.a('object')
				res.body.should.have.property('valid').eql(true)
				done()
			})
	})
})
