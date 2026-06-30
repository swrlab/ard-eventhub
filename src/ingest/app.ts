import logger from '@frytg/logger'
import { Hono } from 'hono'
import { compress } from 'hono/compress'

import config from '@/config/index.ts'
import authRoutes from '@/src/ingest/routes/auth.ts'
import eventsRoutes from '@/src/ingest/routes/events.ts'
import healthRoutes from '@/src/ingest/routes/health.ts'
import openapiRoutes from '@/src/ingest/routes/openapi.ts'
import pubsubRoutes from '@/src/ingest/routes/pubsub.ts'
import subscriptionsRoutes from '@/src/ingest/routes/subscriptions.ts'
import topicsRoutes from '@/src/ingest/routes/topics.ts'
import type { AppVariables } from '@/src/ingest/types.ts'

export const createApp = () => {
	const app = new Hono<{ Variables: AppVariables }>({ strict: false })

	app.use('*', compress())
	app.use('*', async (c, next) => {
		c.header('x-service', config.userAgent)

		if (config.isLocal) {
			const logHeaders = {
				...Object.fromEntries(c.req.raw.headers),
				authorization: 'hidden',
			}
			logger.log({
				level: 'debug',
				message: 'middleware logging',
				source: 'DEV',
				data: { logHeaders, path: c.req.path },
			})
		}

		await next()
	})

	app.route('/openapi', openapiRoutes)
	app.route('/auth', authRoutes)
	app.route('/events', eventsRoutes)
	app.route('/pubsub', pubsubRoutes)
	app.route('/subscriptions', subscriptionsRoutes)
	app.route('/topics', topicsRoutes)
	app.route('/', healthRoutes)

	return app
}

export const app = createApp()
