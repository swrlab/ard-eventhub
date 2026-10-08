import type { Context } from 'hono'
import { Hono } from 'hono'
import { getConnInfo, serveStatic, upgradeWebSocket, websocket } from 'hono/bun'
import { api } from './api.ts'
import { manifestPath, staticRoot, uiAllowCidr, uiHost, uiPort, useHmr } from './env.ts'
import { ipAllowed, parseAllowCidrs, parseTailFilter } from './policy.ts'
import { tail } from './session.ts'
import { readManifest, renderShell } from './shell.ts'

const cidrs = parseAllowCidrs(uiAllowCidr)

const app = new Hono()

/**
 * Socket peer, or an empty string when this fetch has no Bun server (unit tests).
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

let nextId = 1

app.get('/api/tail', async (c) => {
	const parsed = parseTailFilter(c.req.query('filter') ?? null)
	if (!parsed.ok) return c.json({ error: parsed.error }, 400)
	const id = nextId
	nextId += 1
	const filter = parsed.filter
	const ip = peerAddress(c)
	try {
		return await upgradeWebSocket(c, {
			onOpen(_event, ws) {
				tail.open({
					id,
					filter,
					ip,
					send: (frame) => {
						ws.send(frame)
					},
					close: (code, reason) => {
						ws.close(code, reason)
					},
				})
			},
			onMessage(event) {
				const data = event.data
				const text =
					typeof data === 'string'
						? data
						: data instanceof ArrayBuffer || ArrayBuffer.isView(data)
							? new TextDecoder().decode(data)
							: ''
				let body: unknown
				try {
					body = JSON.parse(text) as unknown
				} catch {
					return
				}
				if (typeof body === 'object' && body !== null && 'type' in body && body.type === 'beat') {
					tail.beat(id, Date.now())
				}
			},
			onClose() {
				tail.closed(id)
			},
		})
	} catch {
		return c.text('upgrade failed', 400)
	}
})

app.route('/api', api)

app.use('/static/*', serveStatic({ root: staticRoot }))
app.all('/static/*', (c) => c.text('not found', 404))

app.notFound((c) => {
	if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return c.text('not found', 404)
	return c.html(renderShell(useHmr, readManifest(manifestPath)))
})

export { app }
export default {
	hostname: uiHost,
	port: uiPort,
	fetch: app.fetch,
	idleTimeout: 255,
	websocket: {
		...websocket,
		idleTimeout: 255,
		sendPings: true,
	},
}
