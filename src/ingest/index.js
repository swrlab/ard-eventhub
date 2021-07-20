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
server.listen(process.env.PORT || 8080)
console.log(`/// service is running > ${JSON.stringify(config)}`)
if (process.env.STAGE === 'dev') {
	console.log(`/// open http://localhost:${process.env.PORT || 8080}/openapi/ for API-reference`)
}

module.exports = server
