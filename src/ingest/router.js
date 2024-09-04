// import express.router
const { isIncluded } = require('@swrlab/utils/packages/strings')
const express = require('express')
const { DateTime } = require('luxon')
const OpenApiValidator = require('express-openapi-validator')

// load swagger UI
const swaggerUi = require('swagger-ui-express')
const swaggerDocument = require('../../openapi.json')
const swaggerConfig = require('../../config/swaggerUI')

// set up router
const router = express.Router()
router.use(express.urlencoded({ extended: true }))

// enable body parsing for post requests
router.use(express.json())

// load openapi validator
router.use(
	OpenApiValidator.middleware({
		apiSpec: './openapi.yaml',
		validateRequests: true,
		validateResponses: false,
		ignorePaths: (path) => path.startsWith('/openapi') || path === '/' || path === '/health' || path === '/pubsub',
		formats: {
			'iso8601-timestamp': {
				type: 'string',
				validate: (value) => isIncluded(value, 'T') && DateTime.fromISO(value).isValid,
			},
		},
	})
)

// load response util
const response = require('../utils/response')

// register swagger endpoints
router.get('/openapi/openapi.json', (_req, res) => res.json(swaggerDocument))
router.get('/openapi/openapi.yaml', (_req, res) => res.sendFile('openapi.yaml', { root: '.' }))
router.use('/openapi', swaggerUi.serve, swaggerUi.setup({}, swaggerConfig))

// load auth middleware
const authVerify = require('./auth/middleware/verify')

// register API endpoints
router.post('/auth/login', require('./auth/login/post'))
router.post('/auth/refresh', require('./auth/refresh/post'))
router.post('/auth/reset', require('./auth/reset/post'))

router.post('/events/:eventName', authVerify, require('./events/post'))

router.put('/pubsub/', authVerify, require('./pubsub'))
router.post('/pubsub/', require('./pubsub/verify'), require('./pubsub'))

router.get('/subscriptions/', authVerify, require('./subscriptions/list'))
router.post('/subscriptions/', authVerify, require('./subscriptions/post'))
router.get('/subscriptions/:subscriptionName', authVerify, require('./subscriptions/get'))
router.delete('/subscriptions/:subscriptionName', authVerify, require('./subscriptions/delete'))

router.get('/topics/', authVerify, require('./topics/list'))
router.get('/topics/:topicName', authVerify, require('./topics/list'))

// send health-check ok
router.get(['/', '/health'], (_req, res) => {
	res.sendStatus(200)
})

// set which error message to return (other may contain private information)
const allowedErrors = ['Authorization header required', 'GET method not allowed']

// set openapi error handler
router.use((err, req, res, _next) => {
	// set error message
	let useOriginalError = false
	if (allowedErrors.includes(err.message)) useOriginalError = true
	if (err.message.includes('must have required property') !== -1) useOriginalError = true

	return response.badRequest(req, res, {
		message: useOriginalError ? err.message : 'Bad request',
		errors: useOriginalError ? err.errors : [],
		status: err.status === 401 ? 401 : 400,
	})
})

// export router object to server
module.exports = router
