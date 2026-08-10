import type { Context, MiddlewareHandler, ValidationTargets } from 'hono'
import type { ZodType } from 'zod'
import { badRequest as responseBadRequest } from '../response/bad-request.ts'
import { sanitizeValidationError, zodToOpenApiError } from './zod-to-openapi-error.ts'

type Target = keyof Pick<ValidationTargets, 'json' | 'param'>

/**
 * Create Hono middleware that validates a request target with Zod.
 * On failure, responds with the legacy OpenAPI-validator error envelope.
 * @param target - Validation target (`json` body or `param`)
 * @param schema - Zod schema to apply
 * @returns Hono middleware
 */
export const zodValidate = <T extends ZodType>(target: Target, schema: T): MiddlewareHandler => {
	return async (c, next) => {
		const location = target === 'json' ? 'body' : 'params'
		let value: unknown

		try {
			if (target === 'json') {
				value = await c.req.json()
			} else {
				value = c.req.param()
			}
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
			const mapped = zodToOpenApiError(result.error, location)
			const sanitized = sanitizeValidationError(mapped)
			return responseBadRequest(c, sanitized)
		}

		if (target === 'json') {
			c.set('validatedBody', result.data)
		} else {
			c.set('validatedParams', result.data)
		}

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

/**
 * Read previously validated path params from the Hono context.
 * @param c - Hono context
 * @returns Validated params
 */
export const getValidatedParams = <T>(c: Context): T => {
	return c.get('validatedParams') as T
}
