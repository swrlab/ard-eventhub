/*

	ard-eventhub
	by SWR audio lab

*/

// import express.router
const express = require('express');
const response = require('../utils/response');
const router = express.Router();
router.use(express.urlencoded({ extended: true }));

// enable body parsing for post requests
const bodyParser = require('body-parser');
router.use(bodyParser.json());

// load openapi validator
const OpenApiValidator = require('express-openapi-validator');
const moment = require('moment');
router.use(
	OpenApiValidator.middleware({
		apiSpec: './openapi.yaml',
		validateRequests: true,
		validateResponses: false,
		ignorePaths: (path) => path.startsWith('/openapi'),
		formats: [
			{
				name: 'iso8601-timestamp',
				type: 'string',
				validate: (value) => moment(value, moment.ISO_8601).isValid(),
			},
		],
	})
);

// set openapi error handler
router.use((err, req, res, next) => {
	return response.badRequest(req, res, err);
});

// load swagger UI
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../../openapi.json');
const swaggerConfig = require('../../config/swaggerUI');

// register swagger UI endpoint
router.use('/openapi', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerConfig));

// load auth middleware
const authVerify = require('./auth/middleware/verify');

// register API endpoints
router.post('/auth/login', require('./auth/login/post'));
router.post('/auth/refresh', require('./auth/refresh/post'));
router.post('/auth/reset', require('./auth/reset/post'));

router.post('/events/v1', authVerify, require('./events/post'));

router.get('/subscriptions/', authVerify, require('./subscriptions/list'));
router.post('/subscriptions/', authVerify, require('./subscriptions/post'));
router.get('/subscriptions/:subscriptionName', authVerify, require('./subscriptions/get'));
router.delete('/subscriptions/:subscriptionName', authVerify, require('./subscriptions/delete'));

router.get('/topics/', authVerify, require('./topics/list'));
router.get('/topics/:topicName', authVerify, require('./topics/list'));

// export router object to server
module.exports = router;
