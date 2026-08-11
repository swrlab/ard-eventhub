import { Hono } from 'hono'
import { authLoginBody, authRefreshBody, authResetBody } from '../schemas/auth.ts'
import { subscriptionPost } from '../schemas/subscriptions.ts'
import { jsonBodyLimit } from '../utils/validation/json-body-limit.ts'
import { zodValidate } from '../utils/validation/zod-validate.ts'
import { authLoginPost as login } from './auth/login.ts'
import { authRefreshPost as refresh } from './auth/refresh.ts'
import { authResetPost as reset } from './auth/reset.ts'
import { authVerify } from './auth/verify.ts'
import { eventsPost as events } from './events/post.ts'
import { validateEventBody } from './events/validate.ts'
import { pubsubHandler as pubsub } from './pubsub/index.ts'
import { pubsubAuthVerify } from './pubsub/verify.ts'
import { subscriptionsDelete } from './subscriptions/delete.ts'
import { subscriptionsGet } from './subscriptions/get.ts'
import { subscriptionsList } from './subscriptions/list.ts'
import { subscriptionsPost } from './subscriptions/post.ts'
import { topicsList as topics } from './topics/list.ts'

/** Docs API reference (Blume); replaces the former in-service Swagger UI. */
const DOCS_API_URL = 'https://swrlab.github.io/ard-eventhub/api'

export const router = new Hono({
	strict: false, // this prevents trailing slashes to be different
})

// Restore request-size guard that `express.json()` previously enforced
router.use('*', jsonBodyLimit)

// redirect former Swagger UI to the public docs API reference
router.all('/openapi', (c) => c.redirect(DOCS_API_URL, 302))
router.all('/openapi/*', (c) => c.redirect(DOCS_API_URL, 302))

router.post('/auth/login', zodValidate(authLoginBody), login)
router.post('/auth/refresh', zodValidate(authRefreshBody), refresh)
router.post('/auth/reset', zodValidate(authResetBody), reset)

router.post('/events/:eventName', authVerify, validateEventBody, events)

router.put('/pubsub', authVerify, pubsub)
router.post('/pubsub', pubsubAuthVerify, pubsub)

router.get('/subscriptions', authVerify, subscriptionsList)
router.post('/subscriptions', authVerify, zodValidate(subscriptionPost), subscriptionsPost)
router.get('/subscriptions/:subscriptionName', authVerify, subscriptionsGet)
router.delete('/subscriptions/:subscriptionName', authVerify, subscriptionsDelete)

router.get('/topics', authVerify, topics)
router.get('/topics/:topicName', authVerify, topics)

// send health-check ok
router.get('/', (c) => c.body(null, 200))
router.get('/health', (c) => c.body(null, 200))
