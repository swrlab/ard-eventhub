import { test } from '@cross/test'
import { assertEquals, assertStrictEquals } from '@std/assert'
import { z } from 'zod'
import { iso8601Timestamp } from '../../schemas/common.ts'
import { eventV1PostBody } from '../../schemas/events.ts'
import { isAllowedValidationMessage, sanitizeValidationError, zodToOpenApiError } from './zod-to-openapi-error.ts'

test('zodToOpenApiError maps missing required property', () => {
	const result = eventV1PostBody.safeParse({
		start: '2020-01-19T06:00:00+01:00',
		title: 'Song',
		services: [],
		playlistItemId: 'x',
	})
	assertStrictEquals(result.success, false)
	if (result.success) return

	const mapped = zodToOpenApiError(result.error, 'body')
	assertStrictEquals(mapped.status, 400)
	assertEquals(mapped.message, "request.body should have required property 'type'")
	assertEquals(mapped.errors[0]?.path, '.body.type')
	assertEquals(mapped.errors[0]?.message, "should have required property 'type'")
	assertEquals(mapped.errors[0]?.errorCode, 'required.openapi.validation')
})

test('zodToOpenApiError maps invalid iso8601 timestamp', () => {
	const schema = z.object({ start: iso8601Timestamp })
	const result = schema.safeParse({ start: '2020-01-19T06:00:00+01:0000' })
	assertStrictEquals(result.success, false)
	if (result.success) return

	const mapped = zodToOpenApiError(result.error, 'body')
	assertEquals(mapped.errors[0]?.path, '.body.start')
	assertEquals(mapped.errors[0]?.message, 'should match format "iso8601-timestamp"')
	assertEquals(mapped.errors[0]?.errorCode, 'format.openapi.validation')
})

test('zodToOpenApiError maps null externalId on reference', () => {
	const result = eventV1PostBody.safeParse({
		type: 'music',
		start: '2020-01-19T06:00:00+01:00',
		title: 'Song',
		services: [
			{
				type: 'PermanentLivestream',
				externalId: 'crid://ard.de/28475/unit',
				publisherId: '28475',
			},
		],
		playlistItemId: 'x',
		references: [
			{
				type: 'Article',
				externalId: null,
			},
		],
	})
	assertStrictEquals(result.success, false)
	if (result.success) return

	const mapped = zodToOpenApiError(result.error, 'body')
	assertEquals(mapped.errors[0]?.path, '.body.references.0.externalId')
	assertEquals(mapped.errors[0]?.errorCode, 'type.openapi.validation')
})

test('sanitizeValidationError allows required-property messages', () => {
	const sanitized = sanitizeValidationError({
		status: 400,
		message: "request.body should have required property 'type'",
		errors: [
			{
				path: '.body.type',
				message: "should have required property 'type'",
				errorCode: 'required.openapi.validation',
			},
		],
	})
	assertEquals(sanitized.message, "request.body should have required property 'type'")
	assertEquals(sanitized.errors.length, 1)
})

test('sanitizeValidationError masks unknown messages', () => {
	assertStrictEquals(isAllowedValidationMessage('something private'), false)
	const sanitized = sanitizeValidationError({
		status: 400,
		message: 'something private',
		errors: [{ path: '.body', message: 'secret', errorCode: 'x' }],
	})
	assertEquals(sanitized.message, 'Bad request')
	assertEquals(sanitized.errors, [])
})
