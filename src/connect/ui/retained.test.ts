import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { streamCouldHold } from './retained.ts'

test('retained scan skips streams that cannot hold the filter', () => {
	assertEquals(streamCouldHold(['radio.>'], 'radio.'), true)
	assertEquals(streamCouldHold(['inbox.>'], 'radio.'), false)
	assertEquals(streamCouldHold(['>'], 'feedback.'), true)
	assertEquals(streamCouldHold(['radio.*.track.playing'], 'radio.'), true)
})
