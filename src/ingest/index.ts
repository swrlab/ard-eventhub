/*

    ard-eventhub
    by SWR Audio Lab

*/

// enable tracing
import _utils from '../utils/tracer'

// load node utils
import compression from 'compression'
import express from 'express'

// load utils
import logger from '../utils/logger/index.ts'

// load config
import router from './router.ts'

import config from '../../config'

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
