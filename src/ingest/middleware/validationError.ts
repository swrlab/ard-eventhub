import type { Context } from 'hono'
import type { ZodError } from 'zod'

import responseBadRequest from '@/src/utils/response/badRequest.ts'

const ALLOWED_ERRORS = ['Authorization header required', 'GET method not allowed']

type ValidationErrorItem = {
	path: string
	message: string
	errorCode: string
}

const formatZodPath = (location: string, path: (string | number)[]): string => {
	let result = `.${location}`

	for (const segment of path) {
		if (typeof segment === 'number') {
			result += `[${segment}]`
		} else {
			result += `.${segment}`
		}
	}

	return result
}

const toOpenApiMessage = (issue: ZodError['issues'][number]): string => {
	const field = issue.path.at(-1)

	if (issue.code === 'invalid_type') {
		const invalidIssue = issue as ZodError['issues'][number] & {
			input?: unknown
			received?: string
		}

		if (invalidIssue.input === undefined || invalidIssue.received === 'undefined') {
			return `must have required property '${field}'`
		}
	}

	if (issue.message.includes('received undefined')) {
		return `must have required property '${field}'`
	}

	return issue.message
}

export const mapZodIssues = (error: ZodError, location = 'body'): ValidationErrorItem[] =>
	error.issues.map((issue) => ({
		path: formatZodPath(location, issue.path),
		message: toOpenApiMessage(issue),
		errorCode: 'required.openapi.validation',
	}))

export const mapZodError = (error: ZodError, location = 'body') => {
	const errors = mapZodIssues(error, location)
	const message = errors.some((item) => item.message.includes('must have required property'))
		? errors.map((item) => item.message).join(', ')
		: 'Bad request'

	const useOriginalError =
		ALLOWED_ERRORS.includes(message) || message.includes('must have required property')

	return {
		message: useOriginalError ? message : 'Bad request',
		errors: useOriginalError ? errors : [],
		status: message === 'Authorization header required' ? 401 : 400,
	}
}

export const handleZodValidation = (c: Context, error: ZodError, location = 'body') =>
	responseBadRequest(c, mapZodError(error, location))
