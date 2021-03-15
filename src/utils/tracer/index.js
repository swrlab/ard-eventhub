/*

	ard-eventhub
	by SWR audio lab

*/

require('dd-trace').init({
	enabled: process.env.DD_TRACER_ENABLED === 'true',
	logInjection: true,
	blocklist: ['/', '/health'],
})
