import logger from '@frytg/logger'
import compression from 'compression'
import express from 'express'
import { serviceUrl, userAgent, version } from '#config'
import { isLocal, port, serviceName } from '#env'

import { getARDFeed } from '../data/index.ts'
import router from './router.ts'

await getARDFeed()

const server = express()

// add debugging information to all headers
server.use((req, res, next) => {
	// add service information
	res.set('x-service', userAgent)

	// log all headers in local mode
	if (isLocal) {
		const logHeaders = {
			...req.headers,
			authorization: 'hidden',
		}
		logger.log({
			level: 'debug',
			message: 'middleware logging',
			source: 'DEV',
			data: { logHeaders, path: req.path },
		})
	}
	next()
})

server.use('/', router)
server.use(compression())
server.disable('x-powered-by')

// Run the server if this file is invoked directly
if (import.meta.main) {
	server.listen(port)
}

if (isLocal) {
	console.log(`${serviceName} (v${version}) is running at: ${serviceUrl}`)
	console.log(`  - OpenAPI documentation: ${serviceUrl}/openapi`)
}

export default server
