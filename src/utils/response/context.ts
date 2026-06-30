import type { Context } from 'hono'

export type ResponseContext = Pick<Context, 'req' | 'json' | 'body' | 'status' | 'header'>
