/*

	ard-eventhub
	by SWR audio lab

	this file creates a CLI for hashing ids

*/

// load utils
const createHashedId = require('../utils/core/createHashedId')

// parse input
const input = process.argv[2]

// log output
console.log('INPUT:')
console.log(input)
console.log(' ')
console.log('OUTPUT (CRC64-ECMA182):')
console.log(createHashedId(input))
