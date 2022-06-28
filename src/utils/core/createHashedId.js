/*

	ard-eventhub
	by SWR audio lab

	this file creates a CRC64-ECMA182-compliant hash
	based on an utf-8 encoded input string

*/

// load node utils
const ard = require('@swrlab/utils/packages/ard')

module.exports = (input) => {
	return ard.createHashedId(input)
}
