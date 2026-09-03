import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { feedbackSubject, inboxMqttTopic, inboxSubject, pluginSubject, radioSubject } from './subjects.ts'

const INSTITUTION_ID = 'urn:ard:institution:a3004ff924ece1a2'
const LIVESTREAM_ID = 'urn:ard:permanent-livestream:49267f7d67be180d'

test('topic-tree helpers use NATS subject syntax', () => {
	assertEquals(inboxSubject(INSTITUTION_ID), `inbox.${INSTITUTION_ID}`)
	assertEquals(inboxMqttTopic(INSTITUTION_ID), `inbox/${INSTITUTION_ID}`)
	assertEquals(feedbackSubject(INSTITUTION_ID), `feedback.${INSTITUTION_ID}`)
	assertEquals(radioSubject(LIVESTREAM_ID, 'track.playing'), `radio.${LIVESTREAM_ID}.track.playing`)
	assertEquals(radioSubject(LIVESTREAM_ID, 'control'), `radio.${LIVESTREAM_ID}.control`)
	assertEquals(
		pluginSubject('radioplayer', LIVESTREAM_ID, 'track.playing'),
		`plugin.radioplayer.${LIVESTREAM_ID}.track.playing`
	)
})
