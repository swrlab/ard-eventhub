// import express.router
// @ts-expect-error
import { isIncluded } from '@swrlab/utils/packages/strings'
import express, { type Request, type Response } from 'express'
import { middleware } from 'express-openapi-validator'
import { DateTime } from 'luxon'

// load swagger UI
import swaggerUi from 'swagger-ui-express'
import swaggerConfig from '../../config/swagger-ui'
import swaggerDocument from '../../openapi.json'

// set up router
const router = express.Router()
router.use(express.urlencoded({ extended: true }))

// enable body parsing for post requests
router.use(express.json())

// load openapi validator
router.use(
	middleware({
		apiSpec: './openapi.yaml',
		validateRequests: true,
		validateResponses: false,
		ignorePaths: (path: string) =>
			path.startsWith('/openapi') || path === '/' || path === '/health' || path === '/pubsub',
		formats: {
			'iso8601-timestamp': {
				type: 'string',
				validate: (value) => isIncluded(value, 'T') && DateTime.fromISO(value).isValid,
			},
		},
	})
)

// load response util
import response from '../utils/response'

// register swagger endpoints
router.get('/openapi/openapi.json', (_req: Request, res: Response) => res.json(swaggerDocument))
router.get('/openapi/openapi.yaml', (_req: Request, res: Response) => res.sendFile('openapi.yaml', { root: '.' }))
router.use('/openapi', swaggerUi.serve, swaggerUi.setup({}, swaggerConfig))

// register API endpoints
import login from './auth/login/post'
// load auth middleware
import authVerify from './auth/middleware/verify'
import refresh from './auth/refresh/post'
import reset from './auth/reset/post'
import events from './events/post'
import pubsub from './pubsub'
import pubsubAuthVerify from './pubsub/verify'
import subscriptionsDelete from './subscriptions/delete'
import subscriptionsGet from './subscriptions/get'
import subscriptionsList from './subscriptions/list'
import subscriptionsPost from './subscriptions/post'

import topics from './topics/list'

router.post('/auth/login', login)
router.post('/auth/refresh', refresh)
router.post('/auth/reset', reset)

router.post('/events/:eventName', authVerify, events)

router.put('/pubsub/', authVerify, pubsub)
router.post('/pubsub/', pubsubAuthVerify, pubsub)

router.get('/subscriptions/', authVerify, subscriptionsList)
router.post('/subscriptions/', authVerify, subscriptionsPost)
router.get('/subscriptions/:subscriptionName', authVerify, subscriptionsGet)
router.delete('/subscriptions/:subscriptionName', authVerify, subscriptionsDelete)

router.get('/topics/', authVerify, topics)
router.get('/topics/:topicName', authVerify, topics)

// send health-check ok
router.get(['/', '/health'], (_req: Request, res: Response) => {
	res.sendStatus(200)
})

// set which error message to return (other may contain private information)
const allowedErrors = ['Authorization header required', 'GET method not allowed']

// set openapi error handler
router.use((err: any, req: Request, res: Response) => {
	// set error message
	let useOriginalError = false
	if (allowedErrors.includes(err.message)) useOriginalError = true
	if (err.message.includes('must have required property')) useOriginalError = true

	return response.badRequest(req, res, {
		message: useOriginalError ? err.message : 'Bad request',
		errors: useOriginalError ? err.errors : [],
		status: err.status === 401 ? 401 : 400,
	})
})

// export router object to server
export default router
