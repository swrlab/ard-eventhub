import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { RequestError } from '../../schemas/common.ts'

/**
 * Send a not-found JSON response with optional error details. `trace` is always null (deprecated).
 * @param c - Hono context
 * @param err - Error payload
 * @returns Hono response
 */
export const responseNotFound = (c: Context, err: RequestError) => {
	try {
		return c.json(
			{
				...err.data,
				message: err.message,
				errors: err.errors,
				trace: null,
			},
			(err.status || 404) as ContentfulStatusCode
		)
	} catch {
		return c.body(null, 500)
	}
}
