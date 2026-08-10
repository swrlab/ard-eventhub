import type { AppVariables } from '#types'
import logger from '@frytg/logger'
import { Hono } from 'hono'
import { compress } from 'hono/compress'
import { serviceUrl, userAgent, version } from '#config'
import { isLocal, port, serviceName } from '#env'
import { getARDFeed } from '../data/index.ts'
import createRouter from './router.ts'

await getARDFeed()

const app = new Hono<{ Variables: AppVariables }>({ strict: false })

// add debugging information to all headers
app.use('*', async (c, next) => {
	c.header('x-service', userAgent)

	// log all headers in local mode
	if (isLocal) {
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

app.use('*', compress())
app.route('/', createRouter())

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

export default app
