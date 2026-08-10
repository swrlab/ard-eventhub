import type { Context } from 'hono'

/**
 * Send an internal server error JSON response with a generic message.
 * Never expose Error details to clients. `trace` is always null (deprecated).
 * @param c - Hono context
 * @returns Hono response
 */
export const responseInternalServerError = (c: Context) => {
	try {
		return c.json(
			{
				message: 'Internal Server Error',
				trace: null,
			},
			500
		)
	} catch {
		return c.body(null, 500)
	}
}
