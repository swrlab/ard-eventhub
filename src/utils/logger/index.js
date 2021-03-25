/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const { createLogger, config, format, transports } = require('winston')

// load config
const serviceConfig = require('../../../config')

// add formatters
const convertError = format((event) => {
	if (event?.error instanceof Error) {
		event.error = {
			code: event.error.code,
			message: event.error.message,
			stack: event.error.stack,
		}
	}
	return event
})

const convertGlobals = format((event) => {
	event.serviceName = 'eventhub-ingest'
	event.stage = process.env.STAGE
	event.version = serviceConfig.version
	return event
})

const logger = createLogger({
	level: 'info',
	levels: config.syslog.levels,
	exitOnError: false,
	format: serviceConfig.isDebug
		? format.combine(
				convertError(),
				convertGlobals(),
				format.timestamp(),
				format.json({ space: '\t' }),
				format.colorize({ all: true, colors: { info: 'blue' } })
		  )
		: format.combine(convertError(), convertGlobals(), format.json()),
	transports: [new transports.Console()],
})

module.exports = logger
