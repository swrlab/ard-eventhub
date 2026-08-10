import Index from 'dd-trace'

const tracerI = Index.init({
	logInjection: true,
})

tracerI.use('http', {
	blocklist: ['/', '/health'],
	headers: ['dnt', 'user-agent', 'x-forwarded-host'],
})

export const tracer = tracerI
