import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import {
	eventClassToken,
	feedbackMqttTopic,
	feedbackSubject,
	inboxMqttTopic,
	inboxSubject,
	institutionFromInboxSubject,
	mqttTopicToNatsSubject,
	natsSubjectToMqttTopic,
	pluginSubject,
	radioMqttTopic,
	radioSubject,
} from './subjects.ts'

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
	assertEquals(radioMqttTopic(LIVESTREAM_ID, 'track.playing'), `radio/${LIVESTREAM_ID}/track/playing`)
	assertEquals(radioMqttTopic(LIVESTREAM_ID, 'control'), `radio/${LIVESTREAM_ID}/control`)
	assertEquals(feedbackMqttTopic(INSTITUTION_ID), `feedback/${INSTITUTION_ID}`)
	assertEquals(institutionFromInboxSubject(inboxSubject(INSTITUTION_ID)), INSTITUTION_ID)
	assertEquals(institutionFromInboxSubject('inbox.not-a-urn'), null)
	assertEquals(eventClassToken('de.ard.eventhub.v1.radio.track.playing'), 'track.playing')
	assertEquals(eventClassToken('de.ard.eventhub.v1.radio.control'), 'control')
})

test('MQTT filters map onto NATS subjects and back', () => {
	assertEquals(mqttTopicToNatsSubject('radio/+/track/playing'), 'radio.*.track.playing')
	assertEquals(mqttTopicToNatsSubject('radio/#'), 'radio.>')
	assertEquals(mqttTopicToNatsSubject(`radio/${LIVESTREAM_ID}/track/playing`), `radio.${LIVESTREAM_ID}.track.playing`)
	assertEquals(mqttTopicToNatsSubject('radio/foo.bar/track'), 'radio.foo//bar.track')
	assertEquals(natsSubjectToMqttTopic('radio.*.track.playing'), 'radio/+/track/playing')
	assertEquals(natsSubjectToMqttTopic('radio.>'), 'radio/#')
	assertEquals(natsSubjectToMqttTopic('radio.foo//bar.track'), 'radio/foo.bar/track')
	assertEquals(natsSubjectToMqttTopic(mqttTopicToNatsSubject(`radio/${LIVESTREAM_ID}/#`)), `radio/${LIVESTREAM_ID}/#`)
})
