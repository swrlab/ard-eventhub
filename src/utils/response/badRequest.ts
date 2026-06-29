/*

	ard-eventhub
	by SWR Audio Lab

*/

import type { ContentfulStatusCode } from 'hono/utils/http-status'

import type { ResponseContext } from './context.ts'

export default (c: ResponseContext, err: { message?: string; errors?: unknown; status?: number; data?: object }) => {
	try {
		return c.json(
			{
				...err.data,
				message: err.message,
				errors: err.errors,
				trace: null,
			},
			(err.status || 400) as ContentfulStatusCode,
		)
	} catch (_error) {
		return c.body(null, 500)
	}
}
