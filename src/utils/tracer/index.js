/*

	ard-eventhub
	by SWR audio lab

*/

const tracer = require('dd-trace').init({
	enabled: process.env.DD_TRACER_ENABLED === 'true',
	logInjection: true,
})

tracer.use('express', {
	headers: ['dnt', 'user-agent', 'x-forwarded-host'],
})

tracer.use('http', {
	blocklist: ['/', '/health'],
})

module.exports = tracer
