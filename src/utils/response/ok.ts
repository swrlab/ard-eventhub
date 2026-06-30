/*

	ard-eventhub
	by SWR Audio Lab

*/

import type { ContentfulStatusCode } from 'hono/utils/http-status'

import type { ResponseContext } from './context.ts'

export default (c: ResponseContext, data: object, status: ContentfulStatusCode = 200) => {
	try {
		return c.json(
			{
				...data,
				trace: null,
			},
			status,
		)
	} catch (_error) {
		return c.body(null, 500)
	}
}
