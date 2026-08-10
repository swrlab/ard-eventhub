import type { Context } from 'hono'

/**
 * Send an internal server error JSON response. `trace` is always null (deprecated).
 * @param c - Hono context
 * @param error - Optional Error whose message is exposed
 * @returns Hono response
 */
export const responseInternalServerError = (c: Context, error?: Error) => {
	try {
		return c.json(
			{
				message: error?.message || 'Internal Server Error',
				trace: null,
			},
			500
		)
	} catch {
		return c.body(null, 500)
	}
}
