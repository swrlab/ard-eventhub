import type { Context, MiddlewareHandler } from 'hono'
import type { ZodType } from 'zod'
import { badRequest as responseBadRequest } from '../response/bad-request.ts'
import { sanitizeValidationError, zodToOpenApiError } from './zod-to-openapi-error.ts'

/**
 * Create Hono middleware that validates a JSON request body with Zod.
 * On failure, responds with the legacy OpenAPI-validator error envelope.
 * @param schema - Zod schema to apply
 * @returns Hono middleware
 */
export const zodValidate = <T extends ZodType>(schema: T): MiddlewareHandler => {
	return async (c, next) => {
		let value: unknown

		try {
			value = await c.req.json()
		} catch {
			const sanitized = sanitizeValidationError({
				status: 400,
				message: 'Bad request',
				errors: [],
			})
			return responseBadRequest(c, sanitized)
		}

		const result = schema.safeParse(value)
		if (!result.success) {
			const mapped = zodToOpenApiError(result.error, 'body')
			const sanitized = sanitizeValidationError(mapped)
			return responseBadRequest(c, sanitized)
		}

		c.set('validatedBody', result.data)
		await next()
		return
	}
}

/**
 * Read a previously validated JSON body from the Hono context.
 * @param c - Hono context
 * @returns Validated body
 */
export const getValidatedBody = <T>(c: Context): T => {
	return c.get('validatedBody') as T
}
