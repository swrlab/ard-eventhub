import type { Context } from 'hono'

/**
 * Send an internal server error JSON response.
 * @param c - Hono context
 * @param error - Optional Error whose message is exposed
 * @returns Hono response
 */
export default (c: Context, error?: Error) => {
	try {
		return c.json(
			{
				message: error?.message || 'Internal Server Error',
				trace: c.req.header('x-cloud-trace-context') || null,
			},
			500
		)
	} catch {
		return c.body(null, 500)
	}
}
