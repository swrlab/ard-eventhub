import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { publicRetainedSubject, retainedFilterForStream, streamCouldHold } from './retained.ts'

test('retained scan skips streams that cannot hold the filter', () => {
	assertEquals(streamCouldHold(['radio.>'], 'radio.'), true)
	assertEquals(streamCouldHold(['inbox.>'], 'radio.'), false)
	assertEquals(streamCouldHold(['>'], 'feedback.'), true)
	assertEquals(streamCouldHold(['radio.*.track.playing'], 'radio.'), true)
})

test('mqtt retains are read from $MQTT.rmsgs and reported as the public subject', () => {
	assertEquals(retainedFilterForStream(['$MQTT.rmsgs.>'], 'radio.>'), '$MQTT.rmsgs.radio.>')
	assertEquals(retainedFilterForStream(['$MQTT.rmsgs.>'], 'feedback.>'), '$MQTT.rmsgs.feedback.>')
	assertEquals(retainedFilterForStream(['inbox.>'], 'radio.>'), null)
	assertEquals(retainedFilterForStream(['radio.>'], 'radio.>'), 'radio.>')
	const stored = '$MQTT.rmsgs.radio.urn:ard:permanent-livestream:abc.track.playing'
	assertEquals(publicRetainedSubject(stored), 'radio.urn:ard:permanent-livestream:abc.track.playing')
	assertEquals(publicRetainedSubject('feedback.urn:ard:institution:abc'), 'feedback.urn:ard:institution:abc')
})
