import type { MiddlewareHandler } from 'hono'
import { eventV1PostBody, eventV1PostRadioTextBody } from '../../schemas/events.ts'
import responseBadRequest from '../../utils/response/badRequest.ts'
import { sanitizeValidationError, zodToOpenApiError } from '../../utils/validation/zod-to-openapi-error.ts'

const RADIO_TEXT_EVENT = 'de.ard.eventhub.v1.radio.text'

/**
 * Validate the event POST body with the Zod schema matching the URL event name.
 * @returns Hono middleware
 */
const validateEventBody: MiddlewareHandler = async (c, next) => {
	const eventName = c.req.param('eventName')
	const schema = eventName === RADIO_TEXT_EVENT ? eventV1PostRadioTextBody : eventV1PostBody

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

export default validateEventBody
