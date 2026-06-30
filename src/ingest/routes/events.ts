import { Hono } from 'hono'

import eventsPost from '@/src/ingest/handlers/eventsPost.ts'
import authVerify from '@/src/ingest/middleware/authVerify.ts'
import { handleZodValidation } from '@/src/ingest/middleware/validationError.ts'
import { getEventBodySchema } from '@/src/ingest/schemas/events.ts'
import type { AppVariables } from '@/src/ingest/types.ts'

const eventsRoutes = new Hono<{ Variables: AppVariables }>()

eventsRoutes.post('/:eventName', authVerify, async (c) => {
	const eventName = c.req.param('eventName')
	const body = await c.req.json<Record<string, unknown>>()
	const result = getEventBodySchema(eventName).safeParse(body)

	if (!result.success) {
		return handleZodValidation(c, result.error)
	}

	return eventsPost(c, result.data)
})

export default eventsRoutes
