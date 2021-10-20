/*

	ard-eventhub
	by SWR audio lab

*/

// enable tracing
require('../utils/tracer')

// load node utils
const compression = require('compression')
const express = require('express')

// load utils
const logger = require('../utils/logger')

// load config
const config = require('../../config')

// set up express server
const server = express()

// add debugging information to all headers
server.use((req, res, next) => {
	// add service information
	res.set('x-service', config.userAgent)

	// DEV temporarily log all headers to validate ingress
	const logHeaders = {
		...req.headers,
		authorization: 'hidden',
	}
	logger.log({
		level: 'debug',
		message: `middleware logging`,
		source: 'DEV',
		data: logHeaders,
	})

	// continue with normal workflow
	next()
})

// import router
server.use('/', require('./router'))

// start express server
server.use(compression())
server.disable('x-powered-by')
server.listen(config.port)

if (config.isDev) {
	console.log(`${config.serviceName} (v${config.version}) is running at: ${config.serviceUrl}`)
}

module.exports = server
