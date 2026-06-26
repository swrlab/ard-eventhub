import { describe, expect, it } from 'bun:test'
import { z } from 'zod'

import { mapZodError, mapZodIssues } from '@/src/ingest/middleware/validationError.ts'

describe('validationError', () => {
	it('maps missing required fields to openapi-style errors', () => {
		const schema = z.object({ title: z.string(), start: z.string() }).strict()
		const result = schema.safeParse({})

		expect(result.success).toBe(false)
		if (result.success) return

		const issues = mapZodIssues(result.error)
		expect(issues[0]?.path.startsWith('.body.')).toBe(true)
		expect(issues[0]?.errorCode).toBe('required.openapi.validation')
		expect(issues[0]?.message).toContain("must have required property")
	})

	it('sanitizes non-whitelisted validation errors', () => {
		const schema = z.object({ start: z.string().regex(/^\d+$/) }).strict()
		const result = schema.safeParse({ start: 'abc' })

		expect(result.success).toBe(false)
		if (result.success) return

		const mapped = mapZodError(result.error)
		expect(mapped.message).toBe('Bad request')
		expect(mapped.errors).toEqual([])
		expect(mapped.status).toBe(400)
	})

	it('keeps required property messages visible', () => {
		const schema = z.object({ email: z.string() }).strict()
		const result = schema.safeParse({})

		expect(result.success).toBe(false)
		if (result.success) return

		const mapped = mapZodError(result.error)
		expect(mapped.message).toContain("must have required property 'email'")
		expect(mapped.errors.length).toBeGreaterThan(0)
	})
})
