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
router.use(
	OpenApiValidator.middleware({
		apiSpec: './openapi.yaml',
		validateRequests: true,
		validateResponses: false,
		ignorePaths: (path) => path.startsWith('/openapi'),
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

// register API endpoints
router.post('/events/v1', require('./events/post'));

router.get('/subscriptions/', require('./subscriptions/list'));
router.post('/subscriptions/', require('./subscriptions/post'));
router.get('/subscriptions/:subscriptionName', require('./subscriptions/get'));
router.delete('/subscriptions/:subscriptionName', require('./subscriptions/delete'));

router.get('/topics/', require('./topics/list'));
router.get('/topics/:topicName', require('./topics/list'));

// export router object to server
module.exports = router;
