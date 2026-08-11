import type { Context, MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'

/**
 * Max JSON request body size in bytes (400kb).
 */
export const JSON_BODY_LIMIT_BYTES = 400 * 1024

/**
 * Reject oversized bodies before JSON deserialization (DoS guard).
 * @param c - Hono context
 * @returns 413 JSON response
 */
const onBodyLimitError = (c: Context) =>
	c.json(
		{
			message: 'Payload Too Large',
			errors: [],
			trace: null,
		},
		413
	)

/**
 * Hono middleware restoring the request-size guard that `express.json()` previously enforced.
 */
export const jsonBodyLimit: MiddlewareHandler = bodyLimit({
	maxSize: JSON_BODY_LIMIT_BYTES,
	onError: onBodyLimitError,
})
