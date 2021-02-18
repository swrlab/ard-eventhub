/*

	ard-eventhub
	by SWR audio lab

    unit tests for the ARD-Eventhub API

*/

// Require dependencies
let chai = require('chai');
let chaiHttp = require('chai-http');
let server = require('../src/ingest/index');

// Init funcs and vars
let should = chai.should();
let expect = chai.expect;
let token = null;

// Use chaiHttp
chai.use(chaiHttp);

// Define test cases

/*
* Test the POST /auth/login route
*/
describe('POST /auth/login', () => {
    it('it should return a user with access token', (done) => {
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
                res.body.should.have.property('token').to.be.a('string');
                res.body.should.have.property('refreshToken').to.be.a('string');
                res.body.should.have.property('user').to.be.a('object');
                res.body.user.should.have.property('user_id').to.be.a('string');
                res.body.user.should.have.property('email_verified').eql(true);
                res.body.should.have.property('trace').eql(null);
            done();
            // Store token for further tests
            token = res.body.token;
            });
    });

});

/*
* Test the GET /subscriptions route
*/

describe('GET /subscriptions', () => {
    it('it should GET all subscriptions for this user', (done) => {
      chai.request(server)
            .get('/subscriptions')
            .set('Authorization', 'Bearer ' + token)
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
            done();
        });
    });
});
