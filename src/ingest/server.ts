import { logger } from '@frytg/logger'
import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { serviceUrl, userAgent, version } from '#config'
import { isLocal, port, serviceName } from '#env'
import { getARDFeed } from '../utils/ard-feed.ts'
import { getSafeHeaders } from '../utils/get-safe-headers.ts'
import { router } from './router.ts'

await getARDFeed()

export const app = new Hono({ strict: false })

// add debugging information to all headers
app.use('*', async (c, next) => {
	c.header('x-service', userAgent)

	// log all headers in local mode
	if (isLocal) {
		const logHeaders = getSafeHeaders(c.req.raw.headers)
		logger.debug({
			message: 'middleware logging',
			source: 'DEV',
			data: { logHeaders, path: c.req.path },
		})
	}
	await next()
})

app.use('*', compress())
app.route('/', router)

// Run the server if this file is invoked directly
if (import.meta.main) {
	Bun.serve({
		fetch: app.fetch,
		port: port ?? 8080,
	})
}

if (isLocal) {
	console.log(`${serviceName} (v${version}) is running at: ${serviceUrl}`)
}
