/*

	ard-eventhub
	by SWR Audio Lab

	this file creates a CLI for hashing ids

*/

// load utils
const { createHashedId } = require('@swrlab/utils/packages/ard')

// parse input
const input = process.argv[2]

// log output
console.log('INPUT:')
console.log(input)
console.log(' ')
console.log('OUTPUT (CRC64-ECMA182):')
console.log(createHashedId(input))
