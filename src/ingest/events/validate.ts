import type { MiddlewareHandler } from 'hono'
import type { AuthUser } from '#types'
import { logger } from '@frytg/logger'
import { eventV1PostBody, isConnectEventName } from '../../schemas/events.ts'
import { getSafeHeaders } from '../../utils/get-safe-headers.ts'
import { badRequest as responseBadRequest } from '../../utils/response/bad-request.ts'
import { sanitizeValidationError, zodToOpenApiError } from '../../utils/validation/zod-to-openapi-error.ts'

const source = 'ingest/events/validate'

/**
 * Read an optional string `event` field from a parsed JSON body.
 * @param value - Parsed request body
 * @returns The event name when present and a string
 */
const bodyEventName = (value: unknown): string | undefined => {
	if (value === null || typeof value !== 'object' || !('event' in value)) return undefined
	const event = (value as { event: unknown }).event
	return typeof event === 'string' ? event : undefined
}

/**
 * Validate the event POST body with the track event Zod schema.
 * Connect/MQTT event names are rejected — they are not accepted on HTTPS.
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

	const eventName = c.req.param('eventName')
	const bodyEvent = bodyEventName(value)
	const rejectedName = eventName && isConnectEventName(eventName) ? eventName : bodyEvent
	if (rejectedName && isConnectEventName(rejectedName)) {
		const path = eventName && isConnectEventName(eventName) ? '.params.eventName' : '.body.event'
		const user = c.get('user') as AuthUser | undefined
		logger.warning({
			message: 'Connect event type rejected on HTTPS',
			source,
			data: {
				email: user?.email,
				eventName,
				bodyEvent,
				body: value,
				headers: getSafeHeaders(c.req.raw.headers),
			},
		})
		return responseBadRequest(c, {
			message: 'event type is not accepted on the HTTPS API',
			errors: [
				{
					path,
					message: 'not accepted on the HTTPS API',
					errorCode: 'enum.openapi.validation',
				},
			],
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
