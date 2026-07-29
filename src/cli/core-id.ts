import process from 'node:process'
// @ts-expect-error - The package does not yet have types.
import { createHashedId } from '@swrlab/utils/packages/ard/index.js'

const [input] = process.argv.slice(2)

// log output
console.log('INPUT:')
console.log(input)
console.log(' ')
console.log('OUTPUT (CRC64-ECMA182):')
console.log(createHashedId(input))
