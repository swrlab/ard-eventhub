/*

	ard-eventhub
	by SWR audio lab

*/

// load config
const config = require('../../config')

module.exports = (level, msg) => {
	if (config.stage !== 'dev') {
		return
	}

	let thisMsg = msg

	if (msg instanceof Array) {
		thisMsg = msg.join(' > ')
	}

	if (level === 'log') {
		console.log(thisMsg)
	} else if (level === 'warn') {
		console.warn(thisMsg)
	} else if (level === 'error') {
		console.error(thisMsg)
	}
}
