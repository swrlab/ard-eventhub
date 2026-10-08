import type { ClusterReport, ConnectionsReport, MetaReport, OnAirReport, RejectionsReport } from './types.ts'
import { extname, join, normalize, sep } from 'node:path'
import { Hono } from 'hono'

const MISSING_HTML = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>eventhub connect</title>
<body style="background:#181D16;color:#DDD9C0;font-family:ui-monospace,monospace;margin:2rem">
<p>operator ui is not built.</p>
<p>just ui-build</p>
</body>
</html>`

const CONTENT_TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.json': 'application/json',
}

export type UiDeps = {
	meta: () => MetaReport
	cluster: () => Promise<ClusterReport>
	connections: () => Promise<ConnectionsReport>
	onAir: () => Promise<OnAirReport>
	rejections: (institution: string | null) => Promise<RejectionsReport>
	distDir: string | null
}

/**
 * Resolve a URL path onto a file inside `distDir`, or null when it escapes the directory.
 * @param distDir - Built UI directory
 * @param pathname - Request path
 * @returns Absolute file path, or null
 */
const resolveDistFile = (distDir: string, pathname: string): string | null => {
	let decoded = pathname
	try {
		decoded = decodeURIComponent(pathname)
	} catch {
		return null
	}
	if (decoded.includes('\0')) return null
	const rel = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
	const root = normalize(distDir)
	const full = normalize(join(root, rel))
	if (full !== root && !full.startsWith(root.endsWith(sep) ? root : root + sep)) return null
	return full
}

/**
 * Serve one built file, or null when it is not there.
 * @param distDir - Built UI directory
 * @param pathname - Request path
 * @returns A response, or null so the caller can fall back to `index.html`
 */
const serveFile = async (distDir: string, pathname: string): Promise<Response | null> => {
	const full = resolveDistFile(distDir, pathname)
	if (!full) return new Response('not found', { status: 404 })
	const file = Bun.file(full)
	if (!(await file.exists())) return null
	const type = CONTENT_TYPES[extname(full)] ?? 'application/octet-stream'
	const cache = extname(full) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
	return new Response(file, { headers: { 'content-type': type, 'cache-control': cache } })
}

/**
 * Operator HTTP API plus the built UI. The live tail is not a route on this app.
 * @param deps - Snapshot loaders and the dist directory
 * @returns The Hono app
 */
export const createApp = (deps: UiDeps): Hono => {
	const app = new Hono()

	app.use('*', async (c, next) => {
		await next()
		c.header('x-content-type-options', 'nosniff')
		c.header('referrer-policy', 'no-referrer')
	})
	app.use('/api/*', async (c, next) => {
		await next()
		c.header('cache-control', 'no-store')
	})

	app.get('/api/meta', (c) => c.json(deps.meta()))
	app.get('/api/cluster', async (c) => c.json(await deps.cluster()))
	app.get('/api/connections', async (c) => c.json(await deps.connections()))
	app.get('/api/on-air', async (c) => c.json(await deps.onAir()))
	app.get('/api/rejections', async (c) => {
		const institution = c.req.query('institution')?.trim() || null
		return c.json(await deps.rejections(institution))
	})
	app.all('/api/*', (c) => c.json({ error: 'not found' }, 404))

	app.get('*', async (c) => {
		if (!deps.distDir) {
			return c.html(MISSING_HTML)
		}
		const url = new URL(c.req.url)
		const file = await serveFile(deps.distDir, url.pathname)
		if (file) return file
		const fallback = await serveFile(deps.distDir, '/index.html')
		if (fallback) return fallback
		return c.html(MISSING_HTML)
	})

	return app
}
