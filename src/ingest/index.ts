/*

    ard-eventhub
    by SWR Audio Lab

*/

import logger from '@frytg/logger'
import compression from 'compression'
import express from 'express'
import config from '../../config'

import { getARDFeed } from '../data/index.ts'
import router from './router.ts'

await getARDFeed()

// set up express server
const server = express()

// add debugging information to all headers
server.use((req, res, next) => {
	// add service information
	res.set('x-service', config.userAgent)

	// log all headers in local mode
	if (config.isLocal) {
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

	// continue with normal workflow
	next()
})

// import router
server.use('/', router)

// start express server
server.use(compression())
server.disable('x-powered-by')
server.listen(config.port)

if (config.isLocal) {
	console.log(`${config.serviceName} (v${config.version}) is running at: ${config.serviceUrl}`)
	console.log(`  - OpenAPI documentation: ${config.serviceUrl}/openapi`)
}

export default server
