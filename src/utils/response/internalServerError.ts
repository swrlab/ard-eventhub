/*

	ard-eventhub
	by SWR Audio Lab

*/
import type { ResponseContext } from './context.ts'

export default (c: ResponseContext, error?: Error) => {
	try {
		return c.json(
			{
				message: error?.message || 'Internal Server Error',
				trace: null,
			},
			500,
		)
	} catch (_error) {
		return c.body(null, 500)
	}
}
