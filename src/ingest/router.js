/*

	ard-eventhub
	by SWR audio lab

*/

// import express.router
const express = require('express');
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
	console.log({ err });
	// format errors
	res.status(err.status || 500).json({
		message: err.message,
		errors: err.errors,
	});
});

// load swagger UI
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../../openapi.json');
const swaggerConfig = require('../../config/swaggerUI');

// register swagger UI endpoint
router.use('/openapi', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerConfig));

// register API endpoints
router.post('/event/v1', require('./event/post'));

// export router object to server
module.exports = router;
