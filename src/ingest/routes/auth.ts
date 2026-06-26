import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import authLogin from '@/src/ingest/handlers/authLogin.ts'
import authRefresh from '@/src/ingest/handlers/authRefresh.ts'
import authReset from '@/src/ingest/handlers/authReset.ts'
import { handleZodValidation } from '@/src/ingest/middleware/validationError.ts'
import { authLoginBodySchema, authRefreshBodySchema, authResetBodySchema } from '@/src/ingest/schemas/auth.ts'

const authRoutes = new Hono()

const jsonValidator = <T extends Parameters<typeof zValidator>[1]>(schema: T) =>
	zValidator('json', schema, (result, c) => {
		if (!result.success) {
			return handleZodValidation(c, result.error)
		}
	})

authRoutes.post('/login', jsonValidator(authLoginBodySchema), async (c) =>
	authLogin(c, c.req.valid('json')),
)
authRoutes.post('/refresh', jsonValidator(authRefreshBodySchema), async (c) =>
	authRefresh(c, c.req.valid('json')),
)
authRoutes.post('/reset', jsonValidator(authResetBodySchema), async (c) => authReset(c, c.req.valid('json')))

export default authRoutes
