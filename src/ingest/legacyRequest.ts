import type { Context } from 'hono'

import type { AppVariables } from '@/src/ingest/types.ts'

export type LegacyUserRequest = {
	user?: AppVariables['user']
	body: Record<string, unknown>
	headers: Record<string, string | undefined>
	params?: Record<string, string>
}

export const toLegacyRequest = (
	c: Context<{ Variables: AppVariables }>,
	body: Record<string, unknown>,
): LegacyUserRequest => ({
	user: c.get('user'),
	body,
	headers: Object.fromEntries(c.req.raw.headers.entries()),
	params: c.req.param(),
})
