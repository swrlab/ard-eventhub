import type { MiddlewareHandler } from 'hono'
import type { AuthUser } from '#types'
import logger from '@frytg/logger'
import { eventV1PostBody } from '../../schemas/events.ts'
import { getSafeHeaders } from '../../utils/get-safe-headers.ts'
import { badRequest as responseBadRequest } from '../../utils/response/bad-request.ts'
import { sanitizeValidationError, zodToOpenApiError } from '../../utils/validation/zod-to-openapi-error.ts'

const source = 'ingest/events/validate'

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
		const user = c.get('user') as AuthUser | undefined

		logger.warning({
			message: 'event body failed Zod validation',
			source,
			data: {
				email: user?.email,
				eventName: c.req.param('eventName'),
				body: value,
				errors: mapped.errors,
				message: mapped.message,
				headers: getSafeHeaders(c.req.raw.headers),
			},
		})

		return responseBadRequest(c, sanitized)
	}

	c.set('validatedBody', result.data)
	await next()
	return
}
