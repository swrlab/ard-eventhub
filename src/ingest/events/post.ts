import type { Context } from 'hono'
import type { AuthUser } from '#types'
import logger from '@frytg/logger'
import { isEventStartExpired, parseEventStart } from '../../utils/events/event-helpers.ts'
import { processEvent } from '../../utils/events/process-event.ts'
import { getSafeHeaders } from '../../utils/get-safe-headers.ts'
import { badRequest as responseBadRequest } from '../../utils/response/bad-request.ts'
import { errorsExpiredStartTime } from '../../utils/response/errors/expired-start-time.ts'
import { errorsMismatchingEventName } from '../../utils/response/errors/mismatching-event-name.ts'
import { responseInternalServerError } from '../../utils/response/internal-server-error.ts'
import { responseOk } from '../../utils/response/ok.ts'
import { getValidatedBody } from '../../utils/validation/zod-validate.ts'

const source = 'ingest/events/post'

/**
 * Distribute a radio track or text event to subscribers.
 * @param c - Hono context
 * @returns Event publish response
 */
export const eventsPost = async (c: Context) => {
	const body = getValidatedBody<Record<string, unknown>>(c)
	try {
		const user = c.get('user') as AuthUser | undefined
		if (!user) {
			logger.notice({
				message: 'user not found',
				source,
				data: getSafeHeaders(c.req.raw.headers),
			})
			return responseInternalServerError(c, new Error('User not found'))
		}

		const eventName = c.req.param('eventName')
		if (!eventName) {
			logger.notice({ message: 'Event name not found', source, data: { email: user.email, params: c.req.param() } })
			return responseBadRequest(c, {
				status: 400,
				message: 'Event name not found',
			})
		}

		if (body?.event && body.event !== eventName) {
			return errorsMismatchingEventName(c, body)
		}

		const start = parseEventStart(body.start)
		if (isEventStartExpired(start)) {
			return errorsExpiredStartTime(c, body)
		}

		const data = await processEvent({ eventName, user, body })

		return responseOk(c, data, 201)
	} catch (error) {
		logger.error({
			message: 'failed to publish event',
			source,
			error,
			data: { body, headers: getSafeHeaders(c.req.raw.headers) },
		})

		return responseInternalServerError(c, error as Error)
	}
}
