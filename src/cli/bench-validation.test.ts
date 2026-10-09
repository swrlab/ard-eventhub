import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { runValidationBench } from './bench-validation.ts'

test('an accepted track plans ack', () => {
	assertEquals(runValidationBench('accept', 1), 'ack')
})

test('a schema failure plans term', () => {
	assertEquals(runValidationBench('schema', 1), 'term')
})

test('an unknown livestream plans term', () => {
	assertEquals(runValidationBench('ownership', 1), 'term')
})
