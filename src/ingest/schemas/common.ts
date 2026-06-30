// @ts-expect-error
import { isIncluded } from '@swrlab/utils/packages/strings'
import { DateTime } from 'luxon'
import * as z from 'zod'

export const iso8601Timestamp = z
	.string()
	.refine((value) => isIncluded(value, 'T') && DateTime.fromISO(value).isValid, {
		message: 'Invalid ISO8601 timestamp',
	})
	.meta({ format: 'iso8601-timestamp' })

export const jsonSchemaOptions = {
	target: 'openapi-3.0' as const,
	reused: 'ref' as const,
}

export const toOpenApiSchema = (schema: z.ZodType) => z.toJSONSchema(schema, jsonSchemaOptions)

export const registerSchema = (schema: z.ZodType, id: string) => {
	z.globalRegistry.add(schema, { id })
	return schema
}

export const validationErrorItemSchema = z.object({
	path: z.string(),
	message: z.string(),
	errorCode: z.string(),
})

export const errorBadRequestSchema = registerSchema(
	z.object({
		message: z.string(),
		errors: z.array(validationErrorItemSchema).min(1),
		trace: z.string().nullable().optional(),
	}),
	'errorBadRequest',
)

export const errorUnauthorizedSchema = registerSchema(
	z.object({
		message: z.string(),
		errors: z.array(validationErrorItemSchema).min(1),
		trace: z.string().nullable().optional(),
	}),
	'errorUnauthorized',
)

export const errorForbiddenSchema = registerSchema(
	z.object({
		message: z.string(),
		errors: z.array(validationErrorItemSchema).min(1),
		trace: z.string().nullable().optional(),
	}),
	'errorForbidden',
)

export const errorNotFoundSchema = registerSchema(
	z.object({
		message: z.string(),
		trace: z.string().nullable().optional(),
	}),
	'errorNotFound',
)

export const errorInternalServerErrorSchema = registerSchema(
	z.object({
		message: z.string(),
		trace: z.string().nullable().optional(),
	}),
	'errorInternalServerError',
)
