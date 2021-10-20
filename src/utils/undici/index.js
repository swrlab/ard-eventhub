/*

	ard-eventhub
	by SWR audio lab

*/

// load request handler
const undici = require('undici-wrapper')

// add tracing
const tracer = process.env.DD_TRACER_ENABLED === 'true' ? require('../tracer') : null

// export handler
module.exports = undici(tracer)
