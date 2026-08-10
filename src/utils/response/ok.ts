import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * Send a successful JSON response including the cloud trace header when present.
 * @param c - Hono context
 * @param data - Response body fields
 * @param status - HTTP status (default 200)
 * @returns Hono response
 */
export default (c: Context, data: object, status?: number) => {
	try {
		return c.json(
			{
				...data,
				trace: c.req.header('x-cloud-trace-context') || null,
			},
			(status || 200) as ContentfulStatusCode
		)
	} catch {
		return c.body(null, 500)
	}
}
