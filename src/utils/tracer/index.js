/*

	ard-eventhub
	by SWR audio lab

*/

const tracer = require('dd-trace').init({
	logInjection: true,
})

tracer.use('express', {
	headers: ['dnt', 'user-agent', 'x-forwarded-host'],
})

tracer.use('http', {
	blocklist: ['/', '/health'],
})

module.exports = tracer
