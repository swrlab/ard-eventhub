import type { AuthUser } from './external.ts'

/**
 * Hono context variables set by auth and validation middleware.
 */
export type AppVariables = {
	user?: AuthUser
	validatedBody?: unknown
	validatedParams?: unknown
}
