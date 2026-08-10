import type { MiddlewareHandler } from 'hono'
import { eventV1PostBody } from '../../schemas/events.ts'
import { badRequest as responseBadRequest } from '../../utils/response/bad-request.ts'
import { sanitizeValidationError, zodToOpenApiError } from '../../utils/validation/zod-to-openapi-error.ts'

/**
 * Validate the event POST body with the track event Zod schema.
 * @returns Hono middleware
 */
export const validateEventBody: MiddlewareHandler = async (c, next) => {
	let value: unknown
	try {
		value = await c.req.json()
	} catch {
		return responseBadRequest(c, {
			message: 'Bad request',
			errors: [],
			status: 400,
		})
	}

	const result = eventV1PostBody.safeParse(value)
	if (!result.success) {
		const mapped = zodToOpenApiError(result.error, 'body')
		const sanitized = sanitizeValidationError(mapped)
		return responseBadRequest(c, sanitized)
	}

	c.set('validatedBody', result.data)
	await next()
	return
}
