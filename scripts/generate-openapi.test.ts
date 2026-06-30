import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('openapi artifacts', () => {
	it('openapi.json is valid OpenAPI 3.0.3', () => {
		const document = JSON.parse(readFileSync(join(process.cwd(), 'openapi.json'), 'utf8'))

		expect(document.openapi).toBe('3.0.3')
		expect(document.paths['/auth/login']).toBeDefined()
		expect(document.components.schemas.eventV1PostBody).toBeDefined()
	})
})
