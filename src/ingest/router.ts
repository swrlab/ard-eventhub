import type { AppVariables } from '#types'
import { Hono } from 'hono'
import { authLoginBody, authRefreshBody, authResetBody } from '../schemas/auth.ts'
import { subscriptionPost } from '../schemas/subscriptions.ts'
import { zodValidate } from '../utils/validation/zod-validate.ts'
import login from './auth/login/post.ts'
import authVerify from './auth/middleware/verify.ts'
import refresh from './auth/refresh/post.ts'
import reset from './auth/reset/post.ts'
import events from './events/post.ts'
import validateEventBody from './events/validate.ts'
import pubsub from './pubsub/index.ts'
import pubsubAuthVerify from './pubsub/verify.ts'
import subscriptionsDelete from './subscriptions/delete.ts'
import subscriptionsGet from './subscriptions/get.ts'
import subscriptionsList from './subscriptions/list.ts'
import subscriptionsPost from './subscriptions/post.ts'
import topics from './topics/list.ts'

/** Docs API reference (Blume); replaces the former in-service Swagger UI. */
const DOCS_API_URL = 'https://swrlab.github.io/ard-eventhub/api'

/**
 * Build the ingest API router.
 * @returns Hono router with all ingest routes
 */
const createRouter = () => {
	const router = new Hono<{ Variables: AppVariables }>()

	// redirect former Swagger UI to the public docs API reference
	router.all('/openapi', (c) => c.redirect(DOCS_API_URL, 302))
	router.all('/openapi/*', (c) => c.redirect(DOCS_API_URL, 302))

	router.post('/auth/login', zodValidate('json', authLoginBody), login)
	router.post('/auth/refresh', zodValidate('json', authRefreshBody), refresh)
	router.post('/auth/reset', zodValidate('json', authResetBody), reset)

	router.post('/events/:eventName', authVerify, validateEventBody, events)

	router.put('/pubsub', authVerify, pubsub)
	router.put('/pubsub/', authVerify, pubsub)
	router.post('/pubsub', pubsubAuthVerify, pubsub)
	router.post('/pubsub/', pubsubAuthVerify, pubsub)

	router.get('/subscriptions', authVerify, subscriptionsList)
	router.get('/subscriptions/', authVerify, subscriptionsList)
	router.post('/subscriptions', authVerify, zodValidate('json', subscriptionPost), subscriptionsPost)
	router.post('/subscriptions/', authVerify, zodValidate('json', subscriptionPost), subscriptionsPost)
	router.get('/subscriptions/:subscriptionName', authVerify, subscriptionsGet)
	router.delete('/subscriptions/:subscriptionName', authVerify, subscriptionsDelete)

	router.get('/topics', authVerify, topics)
	router.get('/topics/', authVerify, topics)
	router.get('/topics/:topicName', authVerify, topics)

	// send health-check ok
	router.get('/', (c) => c.body(null, 200))
	router.get('/health', (c) => c.body(null, 200))

	return router
}

export default createRouter
