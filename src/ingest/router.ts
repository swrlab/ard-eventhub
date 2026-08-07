import { DateTime } from '@frytg/dates'
import express, { type Request, type Response } from 'express'
import { middleware } from 'express-openapi-validator'
import responseBadRequest from '../utils/response/badRequest.ts'

/** Docs API reference (Blume); replaces the former in-service Swagger UI. */
const DOCS_API_URL = 'https://swrlab.github.io/ard-eventhub/api'

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
				validate: (value) => value.includes('T') && DateTime.fromISO(value).isValid,
			},
		},
	})
)

// redirect former Swagger UI to the public docs API reference
router.use('/openapi', (_req: Request, res: Response) => {
	res.redirect(302, DOCS_API_URL)
})

// register API endpoints
import login from './auth/login/post.ts'
// load auth middleware
import authVerify from './auth/middleware/verify.ts'
import refresh from './auth/refresh/post.ts'
import reset from './auth/reset/post.ts'
import events from './events/post.ts'
import pubsub from './pubsub/index.ts'
import pubsubAuthVerify from './pubsub/verify.ts'
import subscriptionsDelete from './subscriptions/delete.ts'
import subscriptionsGet from './subscriptions/get.ts'
import subscriptionsList from './subscriptions/list.ts'
import subscriptionsPost from './subscriptions/post.ts'
import topics from './topics/list.ts'

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
// oxlint-disable-next-line typescript/no-explicit-any -- express-openapi-validator error shape
router.use((err: Record<PropertyKey, any>, req: Request, res: Response) => {
	// set error message
	let useOriginalError = false
	if (allowedErrors.includes(err.message)) useOriginalError = true
	if (err.message.includes('must have required property')) useOriginalError = true

	return responseBadRequest(req, res, {
		message: useOriginalError ? err.message : 'Bad request',
		errors: useOriginalError ? err.errors : [],
		status: err.status === 401 ? 401 : 400,
	})
})

export default router
