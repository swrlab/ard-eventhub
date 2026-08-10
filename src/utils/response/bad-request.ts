import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { RequestError } from '#types'

/**
 * Send a bad-request JSON response with optional error details and cloud trace.
 * @param c - Hono context
 * @param err - Error payload
 * @returns Hono response
 */
export const badRequest = (c: Context, err: RequestError) => {
	try {
		return c.json(
			{
				...err.data,
				message: err.message,
				errors: err.errors,
				trace: c.req.header('x-cloud-trace-context') || null,
			},
			(err.status || 400) as ContentfulStatusCode
		)
	} catch {
		return c.body(null, 500)
	}
}
