/*

	ard-eventhub
	by SWR audio lab

	this file creates a CRC64-ECMA182-compliant hash
	based on an utf-8 encoded input string

*/

// load node utils
const crc = require('node-crc')

module.exports = (input) => {
	return crc.crc64(Buffer.from(input, 'utf-8')).toString('hex')
}
