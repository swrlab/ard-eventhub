import type { Context } from 'hono'
import { getConnInfo, serveStatic } from '@hono/bun'
import { Hono } from 'hono'
import { api } from './api.ts'
import { manifestPath, staticRoot, uiAllowCidr, useHmr } from './env.ts'
import { ipAllowed, parseAllowCidrs } from './policy.ts'
import { readManifest, renderShell } from './shell.ts'

const cidrs = parseAllowCidrs(uiAllowCidr)

const app = new Hono()

/**
 * Socket peer, or an empty string when this fetch has no server (unit tests).
 * @param c - Request context
 * @returns Peer address
 */
const peerAddress = (c: Context): string => {
	try {
		return getConnInfo(c).remote.address ?? ''
	} catch {
		return ''
	}
}

app.use('*', async (c, next) => {
	if (cidrs.length > 0 && !ipAllowed(peerAddress(c), cidrs)) return c.text('forbidden', 403)
	await next()
	c.header('x-content-type-options', 'nosniff')
	c.header('referrer-policy', 'no-referrer')
	return c.res
})
app.use('/api/*', async (c, next) => {
	await next()
	c.header('cache-control', 'no-store')
	return c.res
})

app.route('/api', api)

app.use('/static/*', serveStatic({ root: staticRoot }))
app.all('/static/*', (c) => c.text('not found', 404))

app.notFound((c) => {
	if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return c.text('not found', 404)
	return c.html(renderShell(useHmr, readManifest(manifestPath)))
})

export { app }
