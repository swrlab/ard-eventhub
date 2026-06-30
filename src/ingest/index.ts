/*

    ard-eventhub
    by SWR Audio Lab

*/

import config from '@/config/index.ts'
import { getARDFeed } from '@/src/data/index.ts'
import { app } from '@/src/ingest/app.ts'

await getARDFeed()

const server = Bun.serve({
	fetch: app.fetch,
	port: Number(config.port),
})

if (config.isLocal) {
	console.log(`${config.serviceName} (v${config.version}) is running at: ${config.serviceUrl}`)
	console.log(`  - OpenAPI documentation: ${config.serviceUrl}/openapi`)
}

export { app }
export default server
