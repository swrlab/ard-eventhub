import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Send a successful JSON response. `trace` is always null (deprecated field).
 * @param c - Hono context
 * @param data - Response body fields
 * @param status - HTTP status (default 200)
 * @returns Hono response
 */
export const responseOk = (c: Context, data: object, status?: number) => {
	try {
		return c.json(
			{
				...data,
				trace: null,
			},
			(status || 200) as ContentfulStatusCode
		)
	} catch {
		return c.body(null, 500)
	}
}
