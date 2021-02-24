/*

	ard-eventhub
	by SWR audio lab

    unit tests for the ingest service

*/

// Require dependencies
const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../src/ingest/index');

// Init functions
const should = chai.should();
const expect = chai.expect;

// Use chaiHttp
chai.use(chaiHttp);

/*
    AUTH - Authentication services for Eventhub
*/

var accessToken;
var refreshToken;

function testAuthKeys(body) {
	body.should.be.a('object');
	body.should.have.property('expiresIn').to.be.a('number');
	body.should.have.property('expires').to.be.a('string');
	body.should.have.property('token').to.be.a('string');
	body.should.have.property('refreshToken').to.be.a('string');
	body.should.have.property('user').to.be.a('object');
	body.user.should.have.property('user_id').to.be.a('string');
	body.user.should.have.property('email_verified').to.be.a('boolean');
	//body.should.have.property('trace').eql(null);
}

describe('POST /auth/login', () => {
	it('swap login credentials for an id-token', (done) => {
		let loginRequest = {
			email: process.env.TEST_USER,
			password: process.env.TEST_USER_PW,
		};

		chai.request(server)
			.post('/auth/login')
			.send(loginRequest)
			.end((err, res) => {
				res.should.have.status(200);
				testAuthKeys(res.body);
				done();
				// Store tokens for further tests
				accessToken = res.body.token;
				refreshToken = res.body.refreshToken;
			});
	});
});

describe('POST /auth/refresh', () => {
	it('swap refresh-token for new id-token', (done) => {
		let refreshRequest = {
			refreshToken: refreshToken,
		};

		chai.request(server)
			.post('/auth/refresh')
			.send(refreshRequest)
			.end((err, res) => {
				res.should.have.status(200);
				testAuthKeys(res.body);
				done();
				// Store new token for further tests
				accessToken = res.body.token;
			});
	});
});

// 🚨 firebase limit is 150 requests per day 🚨
describe('POST /auth/reset', () => {
	it('request password reset email', (done) => {
		let resetRequest = {
			email: process.env.TEST_USER,
		};

		chai.request(server)
			.post('/auth/reset')
			.send(resetRequest)
			.end((err, res) => {
				res.should.have.status(200);
				done();
			});
	});
});

/*
    EVENTS - Manage events
*/

function testEventKeys(body) {
	body.should.be.a('object');
	body.should.have.property('topics').to.be.a('object');
	body.should.have.property('message').to.be.a('object');
	//body.should.have.property('trace').eql(null);
}

describe('POST /events/v1', () => {
	it('publish a new event', (done) => {
		let event = {
			event: 'de.ard.eventhub.v1.radio.track.playing',
			type: 'music',
			start: '2020-01-19T06:00:00+01:00',
			title: 'Song name',
			serviceIds: ['284680', '284700'],
			playlistItemId: 'swr3-5678',
		};

		chai.request(server)
			.post('/events/v1')
			.set('Authorization', 'Bearer ' + accessToken)
			.send(event)
			.end((err, res) => {
				res.should.have.status(201);
				testEventKeys(res.body);
				done();
			});
	});
});

/*
    SUBSCRIPTIONS - Access to subscription management
*/

var subscriptionName;

function testSubscriptionKeys(body) {
	body.should.be.a('object');
	body.should.have.property('type').to.be.a('string');
	body.should.have.property('method').to.be.a('string');
	body.should.have.property('name').to.be.a('string');
	body.should.have.property('path').to.be.a('string');
	body.should.have.property('url').to.be.a('string');
	body.should.have.property('topic').to.be.a('object');
	body.topic.should.have.property('name').to.be.a('string');
	body.topic.should.have.property('path').to.be.a('string');
	body.should.have.property('ackDeadlineSeconds').to.be.a('number');
	body.should.have.property('retainAckedMessages').to.be.a('boolean');
	//body.should.have.property('retryPolicy').eql(null);
	body.should.have.property('serviceAccount').to.be.a('string');
	body.should.have.property('labels').to.be.a('object');
	body.labels.should.have.property('id').to.be.a('string');
	body.labels.should.have.property('organization').to.be.a('string');
	body.should.have.property('created').to.be.a('string');
	body.should.have.property('contact').to.be.a('string');
	body.should.have.property('owner').to.be.a('string');
}

describe('POST /subscriptions', () => {
	it('add a new subscription to this user', (done) => {
		let subscription = {
			type: 'PUBSUB',
			method: 'PUSH',
			url: 'https://example.com/my/webhook/for/this/subscription',
			contact: 'my-emergency-and-notifications-contact@ard.de',
			topic: 'dev',
		};

		chai.request(server)
			.post('/subscriptions')
			.set('Authorization', 'Bearer ' + accessToken)
			.send(subscription)
			.end((err, res) => {
				res.should.have.status(201);
				testSubscriptionKeys(res.body);
				// Store subscription name for further tests
				subscriptionName = res.body.name;
				done();
			});
	});
});

describe('GET /subscriptions', () => {
	it('list all subscriptions for this user', (done) => {
		chai.request(server)
			.get('/subscriptions')
			.set('Authorization', 'Bearer ' + accessToken)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.be.a('array');
				res.body.every((i) => testSubscriptionKeys(i));
				done();
			});
	});
});

describe('GET /subscriptions/{name}', () => {
	it('get details about single subscription from this user', (done) => {
		chai.request(server)
			.get('/subscriptions/' + subscriptionName)
			.set('Authorization', 'Bearer ' + accessToken)
			.end((err, res) => {
				res.should.have.status(200);
				testSubscriptionKeys(res.body);
				done();
			});
	});
});

describe('DELETE /subscriptions/{name}', () => {
	it('remove a single subscription by this user', (done) => {
		chai.request(server)
			.delete('/subscriptions/' + subscriptionName)
			.set('Authorization', 'Bearer ' + accessToken)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.be.a('object');
				res.body.should.have.property('valid').eql(true);
				//res.body.should.have.property('trace').eql(null);
				done();
			});
	});
});

// /*
//     TOPICS - Access to topics details
// */

function testTopicKeys(body) {
	body.should.be.a('object');
	body.should.have.property('type').to.be.a('string');
	body.should.have.property('name').to.be.a('string');
	body.should.have.property('path').to.be.a('string');
	body.should.have.property('labels').to.be.a('object');
}

describe('GET /topics', () => {
	it('list all available topics', (done) => {
		chai.request(server)
			.get('/topics')
			.set('Authorization', 'Bearer ' + accessToken)
			.end((err, res) => {
				res.should.have.status(200);
				res.body.should.be.a('array');
				res.body.every((i) => testTopicKeys(i));
				done();
			});
	});
});
