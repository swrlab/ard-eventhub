/*

	ard-eventhub
	by SWR audio lab

*/

// enable datadog tracing
require('dd-trace').init({
	enabled: process.env.DD_TRACER_ENABLED === 'true',
	logInjection: true,
})

// load node utils and config
const compression = require('compression')
const express = require('express')
const config = require('../../config')

// set up express server
const server = express()

// add debugging information to all headers
server.use((req, res, next) => {
	// add service information
	res.set('x-service', config.userAgent)

	// continue with normal workflow
	next()
})

// import router
server.use('/', require('./router'))

// start express server
server.use(compression())
server.disable('x-powered-by')
server.listen(process.env.PORT || 8080)
console.log('/// service is running >', JSON.stringify(config))

module.exports = server
