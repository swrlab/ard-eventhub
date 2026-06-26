import type { Context } from 'hono'

export type ResponseContext = Pick<Context, 'req' | 'json' | 'body' | 'status' | 'header'>

export const getTrace = (c: ResponseContext): string | null =>
	c.req.header('x-cloud-trace-context') ?? null
