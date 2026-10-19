import { test } from '@cross/test'
import { assertEquals, assertStrictEquals } from '@std/assert'
import { buildOpenApiDocument } from './document.ts'

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

test('buildOpenApiDocument marks every HTTPS operation deprecated', () => {
	const document = buildOpenApiDocument()
	const operations: string[] = []

	for (const [path, pathItem] of Object.entries(document.paths)) {
		for (const method of HTTP_METHODS) {
			const operation = pathItem[method]
			if (!operation) continue
			operations.push(`${method.toUpperCase()} ${path}`)
			assertStrictEquals(operation.deprecated, true)
			assertEquals(
				operation.description,
				'Deprecated. This HTTPS ingest endpoint stays available until publishers finish moving to Eventhub Connect (MQTT), then it is removed.'
			)
		}
	}

	assertEquals(operations, [
		'POST /auth/login',
		'POST /auth/refresh',
		'POST /auth/reset',
		'POST /events/de.ard.eventhub.v1.radio.track.next',
		'POST /events/de.ard.eventhub.v1.radio.track.playing',
		'GET /subscriptions',
		'POST /subscriptions',
		'GET /subscriptions/{name}',
		'DELETE /subscriptions/{name}',
		'GET /topics',
	])
	assertEquals(document.info.description?.includes('This HTTPS API is deprecated.'), true)
})
