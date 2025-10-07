/*

	ard-eventhub
	by SWR Audio Lab

*/

// load node utils
import os from 'node:os'
import { createLogger, config, format, transports } from 'winston'

// get version
import { version } from '../../../package.json'

const hostName = os.hostname()

// set error formatter
const convertError = format((event) => {
	const error = event?.error
	if (error instanceof Error) {
		event.error = {
			code: error['code' as keyof typeof error],
			message: error.message,
			stack: error.stack,
		}
	}
	return event
})

// set converter for globals
const convertGlobals = format((event) => {
	event.host = process.env.K_REVISION || hostName
	event.serviceName = process.env.SERVICE_NAME
	event.stage = process.env.STAGE
	event.version = version
	event.nodeVersion = process.version
	return event
})

// set format converters
let formatConfig = format.combine(convertError(), convertGlobals(), format.json())
if (process.env.IS_LOCAL === 'true') {
	formatConfig = format.combine(
		convertError(),
		convertGlobals(),
		format.timestamp(),
		format.json({ space: 4 }),
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

export default logger
