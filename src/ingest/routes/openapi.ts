import { swaggerUI } from '@hono/swagger-ui'
import { Hono } from 'hono'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import swaggerConfig from '@/config/swagger-ui.ts'

const openapiRoutes = new Hono()

openapiRoutes.get('/openapi.json', (c) => {
	const document = readFileSync(join(process.cwd(), 'openapi.json'), 'utf8')
	return c.json(JSON.parse(document))
})

openapiRoutes.get(
	'/',
	swaggerUI({
		url: swaggerConfig.swaggerOptions.url,
		...(swaggerConfig.customCss ? { customCss: swaggerConfig.customCss } : {}),
		...(swaggerConfig.customSiteTitle ? { title: swaggerConfig.customSiteTitle } : {}),
	}),
)

export default openapiRoutes
