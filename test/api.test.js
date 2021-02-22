/*

	ard-eventhub
	by SWR audio lab

    unit tests for the ARD-Eventhub API

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

var accessToken = null;
var refreshToken = null;

describe('POST /auth/login', () => {
    it('swap login credentials for an id-token', (done) => {
        let login = {
            email: process.env.TEST_USER,
            password: process.env.TEST_USER_PW
        }

        chai.request(server)
            .post('/auth/login')
            .send(login)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('expiresIn').to.be.a('number');
                res.body.should.have.property('expires').to.be.a('string');
                res.body.should.have.property('token').to.be.a('string');
                res.body.should.have.property('refreshToken').to.be.a('string');
                res.body.should.have.property('user').to.be.a('object');
                res.body.user.should.have.property('user_id').to.be.a('string');
                res.body.user.should.have.property('email_verified').to.be.a('boolean');
                res.body.should.have.property('trace').eql(null);
            done();
            // Store tokens for further tests
            accessToken = res.body.token;
            refreshToken = res.body.refreshToken;
            });
    });
});

describe('POST /auth/refresh', () => {
    it('swap refresh-token for new id-token', (done) => {
        let refresh = {
            refreshToken: refreshToken
        }

        chai.request(server)
            .post('/auth/refresh')
            .send(refresh)
            .end((err, res) => {
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.should.have.property('expiresIn').to.be.a('number');
                res.body.should.have.property('expires').to.be.a('string');
                res.body.should.have.property('token').to.be.a('string');
                res.body.should.have.property('refreshToken').to.be.a('string');
                res.body.should.have.property('user').to.be.a('object');
                res.body.user.should.have.property('user_id').to.be.a('string');
                res.body.user.should.have.property('email_verified').to.be.a('boolean');
                res.body.should.have.property('trace').eql(null);
            done();
            // Store new token for further tests
            accessToken = res.body.token;
            });
    });
});

describe('POST /auth/reset', () => {
    it('request password reset email', (done) => {
        let reset = {
            email: process.env.TEST_USER
        }

        chai.request(server)
            .post('/auth/reset')
            .send(reset)
            .end((err, res) => {
                res.should.have.status(200);
            done();
            });
    });
});

/*
    EVENTS - Manage events
*/

describe('POST /events/v1', () => {
    it('publish a new event', (done) => {
        let body = {
            "event": "de.ard.eventhub.v1.radio.track.playing",
            "type": "music",
            "start": "2020-01-19T06:00:00+01:00",
            "title": "Song name",
            "serviceIds": [
                "284680",
                "284700"
            ],
            "playlistItemId": "swr3-5678"
        }

        chai.request(server)
            .post('/events/v1')
            .set('Authorization', 'Bearer ' + accessToken)
            .send(body)
            .end((err, res) => {
                res.should.have.status(201);
                res.body.should.be.a('object');
                res.body.should.have.property('topics').to.be.a('object');
                res.body.should.have.property('message').to.be.a('object');
                res.body.should.have.property('trace').eql(null);
            done();
            });
    });
});

/*
    SUBSCRIPTIONS - Access to subscription management
*/

var subscriptionName = null;

describe('POST /subscriptions', () => {
    it('add a new subscription to this user', (done) => {
        let body = {
            "type": "PUBSUB",
            "method": "PUSH",
            "url": "https://example.com/my/webhook/for/this/subscription",
            "contact": "my-emergency-and-notifications-contact@ard.de",
            "topic": "dev"
        }

        chai.request(server)
            .post('/subscriptions')
            .set('Authorization', 'Bearer ' + accessToken)
            .send(body)
            .end((err, res) => {
                res.should.have.status(201);
                res.body.should.be.a('object');
                res.body.to.have.all.keys(
                    'type', 
                    'method', 
                    'name', 
                    'path', 
                    'url', 
                    'topic',
                    'ackDeadlineSeconds',
                    'retainAckedMessages',
                    'retryPolicy',
                    'serviceAccount',
                    'labels',
                    'created',
                    'contact',
                    'owner'
                    )
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
                res.body.every(i => expect(i).to.have.all.keys(
                    'type', 
                    'method', 
                    'name', 
                    'path', 
                    'url', 
                    'topic',
                    'ackDeadlineSeconds',
                    'retainAckedMessages',
                    'retryPolicy',
                    'serviceAccount',
                    'labels',
                    'created',
                    'contact',
                    'owner'
                    ))
                // Store subscription name for further tests
                subscriptionName = res.body.name;
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
                res.body.should.be.a('object');
                res.body.to.have.all.keys(
                    'type', 
                    'method', 
                    'name', 
                    'path', 
                    'url', 
                    'topic',
                    'ackDeadlineSeconds',
                    'retainAckedMessages',
                    'retryPolicy',
                    'serviceAccount',
                    'labels',
                    'created',
                    'contact',
                    'owner'
                    )
            done();
        });
    });
});

/*
    TOPICS - Access to topics details
*/
