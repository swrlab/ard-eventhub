import { test } from '@cross/test'
import { assertEquals, assertExists, assertStrictEquals } from '@std/assert'
import { buildOpenApiDocument } from './document.ts'

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

type SchemaObject = {
	$ref?: string
	definitions?: unknown
	$defs?: unknown
	properties?: Record<string, SchemaObject>
	items?: SchemaObject
}

/**
 * Recursively collect leftover JSON Schema definition bags and `#/definitions` refs.
 * @param node - OpenAPI schema fragment
 * @param leftoverDefs - Paths that still have `definitions` or `$defs`
 * @param leftoverRefs - `$ref` values that still point at `#/definitions` or `#/$defs`
 * @param path - JSON Pointer-ish path for assertion messages
 */
const collectBrokenSchemaPointers = (
	node: unknown,
	leftoverDefs: string[],
	leftoverRefs: string[],
	path: string
): void => {
	if (Array.isArray(node)) {
		for (const [index, item] of node.entries()) {
			collectBrokenSchemaPointers(item, leftoverDefs, leftoverRefs, `${path}/${index}`)
		}
		return
	}
	if (!node || typeof node !== 'object') return

	const obj = node as Record<string, unknown>
	if ('definitions' in obj || '$defs' in obj) leftoverDefs.push(path)
	if (typeof obj.$ref === 'string' && /#\/(?:definitions|\$defs)\//.test(obj.$ref)) {
		leftoverRefs.push(`${path} -> ${obj.$ref}`)
	}
	for (const [key, value] of Object.entries(obj)) {
		collectBrokenSchemaPointers(value, leftoverDefs, leftoverRefs, `${path}/${key}`)
	}
}

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

test('buildOpenApiDocument hoists nested Zod definitions so docs can expand media and references', () => {
	const document = buildOpenApiDocument()
	const schemas = document.components.schemas as Record<string, SchemaObject>

	const leftoverDefs: string[] = []
	const leftoverRefs: string[] = []
	collectBrokenSchemaPointers(schemas, leftoverDefs, leftoverRefs, '#/components/schemas')
	assertEquals(leftoverDefs, [])
	assertEquals(leftoverRefs, [])

	for (const [id, schema] of Object.entries(schemas)) {
		assertEquals(schema.$ref === `#/components/schemas/${id}`, false)
	}

	const eventBody = schemas.eventV1PostBody
	assertExists(eventBody?.properties)
	assertEquals(eventBody.properties.media?.items?.$ref, '#/components/schemas/mediaItem')
	assertEquals(eventBody.properties.references?.items?.$ref, '#/components/schemas/reference')
	assertEquals(eventBody.properties.contributors?.items?.$ref, '#/components/schemas/contributor')
	assertEquals(eventBody.properties.services?.items?.$ref, '#/components/schemas/services')

	const mediaItem = schemas.mediaItem
	assertExists(mediaItem?.properties)
	assertEquals(Object.keys(mediaItem.properties), [
		'type',
		'url',
		'templateUrl',
		'description',
		'attribution',
		'isFallback',
	])

	const reference = schemas.reference
	assertExists(reference?.properties)
	assertEquals(Object.keys(reference.properties), ['type', 'id', 'externalId', 'title', 'url', 'alternateIds'])

	const eventRes = schemas.eventV1ResBody
	assertEquals(eventRes?.properties?.event?.$ref, '#/components/schemas/eventV1PostBody')

	const errorBadRequest = schemas.errorBadRequest
	assertEquals(errorBadRequest?.properties?.errors?.items?.$ref, '#/components/schemas/openApiErrorItem')
	assertExists(schemas.openApiErrorItem?.properties?.errorCode)
})
