# regenerate openapi.json from Zod schemas
[group('DOCS')]
openapi: asyncapi
	bun run ./src/openapi/generate.ts
	bun x oxfmt openapi.json

# regenerate asyncapi.json from Zod schemas (Eventhub Connect / MQTT)
[group('DOCS')]
asyncapi:
	bun run ./src/asyncapi/generate.ts
	bun x oxfmt asyncapi.json

# serve the documentation (dev server with hot reload)
[group('DOCS')]
docs: openapi
	bun x blume dev

# build the documentation to dist/
[group('DOCS')]
docs-build: openapi
	bun x blume build

# preview the built documentation
[group('DOCS')]
docs-preview:
	bun x blume preview
