import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import subscriptionsDelete from '@/src/ingest/handlers/subscriptionsDelete.ts'
import subscriptionsGet from '@/src/ingest/handlers/subscriptionsGet.ts'
import subscriptionsList from '@/src/ingest/handlers/subscriptionsList.ts'
import subscriptionsPost from '@/src/ingest/handlers/subscriptionsPost.ts'
import authVerify from '@/src/ingest/middleware/authVerify.ts'
import { handleZodValidation } from '@/src/ingest/middleware/validationError.ts'
import { subscriptionPostSchema } from '@/src/ingest/schemas/subscriptions.ts'
import type { AppVariables } from '@/src/ingest/types.ts'

const subscriptionsRoutes = new Hono<{ Variables: AppVariables }>()

const jsonValidator = zValidator('json', subscriptionPostSchema, (result, c) => {
	if (!result.success) {
		return handleZodValidation(c, result.error)
	}
})

subscriptionsRoutes.get('/', authVerify, subscriptionsList)
subscriptionsRoutes.post('/', authVerify, jsonValidator, async (c) => subscriptionsPost(c, c.req.valid('json')))
subscriptionsRoutes.get('/:subscriptionName', authVerify, subscriptionsGet)
subscriptionsRoutes.delete('/:subscriptionName', authVerify, subscriptionsDelete)

export default subscriptionsRoutes
