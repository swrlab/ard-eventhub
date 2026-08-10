import { DateTime } from '@frytg/dates'
import { z } from 'zod'

/**
 * ISO8601 timestamp matching the former OpenAPI `iso8601-timestamp` format.
 * Must contain `T` and parse via Luxon `DateTime.fromISO`.
 */
export const iso8601Timestamp = z
	.string()
	.refine((value) => value.includes('T') && DateTime.fromISO(value).isValid, {
		message: 'must be a valid iso8601-timestamp',
	})
	.meta({
		description: 'ISO8601 compliant timestamp',
		examples: ['2020-01-19T06:00:00+01:00'],
	})

/**
 * Shared OpenAPI error item shape used in docs and request errors.
 */
const openApiErrorItem = z
	.object({
		path: z.string(),
		message: z.string(),
		errorCode: z.string(),
	})
	.meta({ id: 'openApiErrorItem' })

/**
 * Error payload passed to HTTP response helpers.
 */
export const requestError = z.object({
	status: z.number().optional(),
	message: z.string(),
	errors: z.union([z.string(), z.array(openApiErrorItem)]).optional(),
	data: z.record(z.string(), z.string()).optional(),
	trace: z.string().optional(),
})

export type RequestError = z.infer<typeof requestError>

/**
 * Bad request error response schema for OpenAPI docs.
 */
export const errorBadRequest = z
	.object({
		message: z.string().meta({ examples: ["request.body should have required property 'XYZ'"] }),
		errors: z.array(openApiErrorItem).min(1),
		trace: z
			.string()
			.nullable()
			.meta({ examples: [null] }),
	})
	.meta({ id: 'errorBadRequest' })

/**
 * Unauthorized error response schema for OpenAPI docs.
 */
export const errorUnauthorized = z
	.object({
		message: z.string().meta({ examples: ["request.headers should have required property 'Authorization'"] }),
		errors: z.array(openApiErrorItem).min(1),
		trace: z
			.string()
			.nullable()
			.meta({ examples: [null] }),
	})
	.meta({ id: 'errorUnauthorized' })

/**
 * Forbidden error response schema for OpenAPI docs.
 */
export const errorForbidden = z
	.object({
		message: z.string().meta({ examples: ['user is missing required permission'] }),
		errors: z.array(openApiErrorItem).min(1),
		trace: z
			.string()
			.nullable()
			.meta({ examples: [null] }),
	})
	.meta({ id: 'errorForbidden' })

/**
 * Not found error response schema for OpenAPI docs.
 */
export const errorNotFound = z
	.object({
		message: z.string().meta({ examples: ["object 'object.name' not found"] }),
		trace: z
			.string()
			.nullable()
			.meta({ examples: [null] }),
	})
	.meta({ id: 'errorNotFound' })

/**
 * Internal server error response schema for OpenAPI docs.
 */
export const errorInternalServerError = z
	.object({
		message: z.string().meta({ examples: ['Internal Server Error'] }),
		trace: z
			.string()
			.nullable()
			.meta({ examples: [null] }),
	})
	.meta({ id: 'errorInternalServerError' })
