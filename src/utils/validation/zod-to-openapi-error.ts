import { z } from 'zod'

/** Single OpenAPI-validator-compatible error item. */
export type OpenApiValidationErrorItem = {
	path: string
	message: string
	errorCode: string
}

/** OpenAPI-validator-compatible validation error payload. */
export type OpenApiValidationError = {
	status: number
	message: string
	errors: OpenApiValidationErrorItem[]
}

/**
 * Format a Zod path into an OpenAPI-validator style path (e.g. `.body.start`).
 * @param location - Request location prefix (`body`, `params`, `headers`)
 * @param path - Zod issue path segments
 * @returns Dot-prefixed path string
 */
const formatPath = (location: string, path: PropertyKey[]): string => {
	const segments = path.map(String)
	if (segments.length === 0) return `.${location}`
	return `.${location}.${segments.join('.')}`
}

/**
 * Whether a Zod invalid_type issue represents a missing (undefined) value.
 * @param issue - Zod issue
 * @returns True when the value was missing
 */
const isMissingValue = (issue: z.core.$ZodIssue): boolean => {
	const typed = issue as { input?: unknown }
	if ('input' in typed) return typed.input === undefined
	return issue.message.includes('undefined')
}

/**
 * Map a single Zod issue to OpenAPI-validator wording.
 * @param issue - Zod issue
 * @param location - Request location prefix
 * @returns OpenAPI-style error item
 */
const mapIssue = (issue: z.core.$ZodIssue, location: string): OpenApiValidationErrorItem => {
	const path = formatPath(location, issue.path)
	const lastSegment = issue.path.length > 0 ? String(issue.path[issue.path.length - 1]) : location

	if (issue.code === 'invalid_type') {
		const typed = issue as { expected?: string }
		if (isMissingValue(issue)) {
			return {
				path,
				message: `should have required property '${lastSegment}'`,
				errorCode: 'required.openapi.validation',
			}
		}
		return {
			path,
			message: `should be ${typed.expected ?? 'string'}`,
			errorCode: 'type.openapi.validation',
		}
	}

	if (issue.code === 'unrecognized_keys') {
		const keys = (issue as { keys?: string[] }).keys ?? []
		const key = keys[0] ?? lastSegment
		return {
			path: formatPath(location, [...issue.path, key]),
			message: `should NOT have additional properties`,
			errorCode: 'additionalProperties.openapi.validation',
		}
	}

	if (issue.code === 'invalid_value' || issue.code === 'invalid_union') {
		return {
			path,
			message: issue.message || `should match allowed values`,
			errorCode: 'enum.openapi.validation',
		}
	}

	if (issue.code === 'invalid_format') {
		return {
			path,
			message: `should match format "${(issue as { format?: string }).format ?? 'unknown'}"`,
			errorCode: 'format.openapi.validation',
		}
	}

	if (issue.code === 'custom') {
		const message = issue.message.includes('iso8601') ? `should match format "iso8601-timestamp"` : issue.message
		return {
			path,
			message,
			errorCode: 'format.openapi.validation',
		}
	}

	return {
		path,
		message: issue.message,
		errorCode: 'type.openapi.validation',
	}
}

/**
 * Build the top-level OpenAPI-validator message for the first issue.
 * @param issue - First mapped error item
 * @param location - Request location prefix
 * @returns Top-level message string
 */
const buildTopLevelMessage = (issue: OpenApiValidationErrorItem, location: string): string => {
	if (issue.errorCode === 'required.openapi.validation') {
		const property = issue.path.split('.').pop() ?? 'property'
		return `request.${location} should have required property '${property}'`
	}
	if (issue.errorCode === 'additionalProperties.openapi.validation') {
		return `request.${location} should NOT have additional properties`
	}
	if (issue.errorCode.startsWith('format.')) {
		const field = issue.path.replace(/^\./, 'request.')
		return `${field} ${issue.message}`
	}
	const field = issue.path.replace(/^\./, 'request.')
	return `${field} ${issue.message}`
}

/**
 * Convert a ZodError into an express-openapi-validator compatible error object.
 * @param error - Zod validation error
 * @param location - Request location that was validated (`body`, `params`, `headers`)
 * @param status - HTTP status to attach (default 400)
 * @returns OpenAPI-validator-shaped error
 */
export const zodToOpenApiError = (
	error: z.ZodError,
	location: 'body' | 'params' | 'headers' = 'body',
	status = 400
): OpenApiValidationError => {
	const errors = error.issues.map((issue) => mapIssue(issue, location))
	const first = errors[0] ?? {
		path: `.${location}`,
		message: 'Bad request',
		errorCode: 'type.openapi.validation',
	}

	return {
		status,
		message: buildTopLevelMessage(first, location),
		errors,
	}
}

/**
 * Whether the validation error message may be returned to clients as-is.
 * Mirrors the former Express OpenAPI error sanitizer allowlist.
 * @param message - Error message
 * @returns True when the original message is safe to expose
 */
export const isAllowedValidationMessage = (message: string): boolean => {
	const allowedErrors = ['Authorization header required', 'GET method not allowed']
	if (allowedErrors.includes(message)) return true
	if (message.includes('must have required property')) return true
	if (message.includes('should have required property')) return true
	return false
}

/**
 * Sanitize a validation error for client output (strip potentially private details).
 * @param err - OpenAPI-shaped validation error
 * @returns Client-safe message and errors list
 */
export const sanitizeValidationError = (
	err: OpenApiValidationError
): { message: string; errors: OpenApiValidationErrorItem[]; status: number } => {
	const useOriginalError = isAllowedValidationMessage(err.message)
	return {
		message: useOriginalError ? err.message : 'Bad request',
		errors: useOriginalError ? err.errors : [],
		status: err.status === 401 ? 401 : 400,
	}
}
