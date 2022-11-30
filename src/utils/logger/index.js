/*

	ard-eventhub
	by SWR audio lab

*/

// load node utils
const { createLogger, config, format, transports } = require('winston')

// get version
const { version } = require('../../../package.json')

// set error formatter
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

// set converter for globals
const convertGlobals = format((event) => {
	event.serviceName = 'eventhub-ingest'
	event.stage = process.env.STAGE
	event.version = version
	event.nodeVersion = process.version
	return event
})

// set format converters
let formatConfig = format.combine(convertError(), convertGlobals(), format.json())
if (process.env.DEBUG === 'true') {
	formatConfig = format.combine(
		convertError(),
		convertGlobals(),
		format.timestamp(),
		format.json({ space: '\t' }),
		format.colorize({ all: true, colors: { info: 'blue' } })
	)
}

// initialize logger
const logger = createLogger({
	level: process.env.STAGE === 'dev' ? 'debug' : 'info',
	levels: config.syslog.levels,
	exitOnError: false,
	format: formatConfig,
	transports: [new transports.Console()],
})

module.exports = logger
