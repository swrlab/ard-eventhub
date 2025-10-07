/*

	ard-eventhub
	by SWR Audio Lab

*/

import Index from 'dd-trace'

const tracerI = Index.init({
	logInjection: true,
})

tracerI.use('express', {
	headers: ['dnt', 'user-agent', 'x-forwarded-host'],
})

tracerI.use('http', {
	blocklist: ['/', '/health'],
})

export const tracer = tracerI
