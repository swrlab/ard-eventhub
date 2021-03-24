//

const createHashedId = require('./utils/core/createHashedId')

let hash = createHashedId('crid://daserste.de/babylon-mainz')
console.log(hash, hash === '070a6aedae073d48')

hash = createHashedId('crid://daserste.de/tagesschau mit Gebärdensprache/1e9089b3-e382-4f1e-924c-51acb1c6f011')
console.log(hash, hash === 'ff2ff8028b092c5b')

hash = createHashedId('crid://èéêë')
console.log(hash, hash === '2a498d5c45795dd2')

hash = createHashedId('crid://tagebücher')
console.log(hash, hash === 'a02a0ab1265bc40c')

hash = createHashedId('284680')
console.log(hash)

hash = createHashedId('28468')
console.log(hash)
