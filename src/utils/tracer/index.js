/*

	ard-eventhub
	by SWR Audio Lab

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
