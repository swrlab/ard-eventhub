import { test } from '@cross/test'
import { logger } from '@frytg/logger'
import { assert, assertEquals } from '@std/assert'
import { createSandbox } from 'sinon'
import { isMqttBrokerConfigured, mqttClient } from './_client.ts'
import { inboxTopic, mqttInbox, publishInboxMessage } from './publish-inbox.ts'

const INSTITUTION_ID = 'urn:ard:institution:a3004ff924ece1a2'
const PAYLOAD = { id: `${INSTITUTION_ID}-01`, event: 'de.ard.eventhub.v1.radio.track.playing' }

test('inboxTopic prefixes the institution URN', () => {
	assertEquals(inboxTopic(INSTITUTION_ID), `inbox/${INSTITUTION_ID}`)
})

test('isMqttBrokerConfigured treats a blank URL as no hop', () => {
	assertEquals(isMqttBrokerConfigured(''), false)
	assertEquals(isMqttBrokerConfigured('   '), false)
	assertEquals(isMqttBrokerConfigured('mqtt://127.0.0.1:1883'), true)
})

test('publishInboxMessage does nothing when no client is configured', async () => {
	const sandbox = createSandbox()
	const warning = sandbox.stub(logger, 'warning')

	try {
		await publishInboxMessage(undefined, INSTITUTION_ID, PAYLOAD)
		assertEquals(warning.called, false)
	} finally {
		sandbox.restore()
	}
})

test('mqttInbox.publish sends JSON to inbox/{institutionId} with QoS 1 and retain false', async () => {
	assert(mqttClient, 'MQTT_BROKER_URL is required for this test')
	const sandbox = createSandbox()
	sandbox.stub(mqttClient, 'connected').get(() => true)
	const publishAsync = sandbox.stub(mqttClient, 'publishAsync').resolves()

	try {
		await mqttInbox.publish(INSTITUTION_ID, PAYLOAD)
		assertEquals(publishAsync.calledOnce, true)
		assertEquals(publishAsync.firstCall.args[0], `inbox/${INSTITUTION_ID}`)
		assertEquals(publishAsync.firstCall.args[1], JSON.stringify(PAYLOAD))
		assertEquals(publishAsync.firstCall.args[2], { qos: 1, retain: false })
	} finally {
		sandbox.restore()
	}
})

test('mqttInbox.publish does not throw when the broker publish fails', async () => {
	assert(mqttClient, 'MQTT_BROKER_URL is required for this test')
	const sandbox = createSandbox()
	sandbox.stub(mqttClient, 'connected').get(() => true)
	sandbox.stub(mqttClient, 'publishAsync').rejects(new Error('broker down'))
	sandbox.stub(logger, 'warning')

	try {
		await mqttInbox.publish(INSTITUTION_ID, PAYLOAD)
	} finally {
		sandbox.restore()
	}
})

test('mqttInbox.publish does not throw when the client is not connected', async () => {
	assert(mqttClient, 'MQTT_BROKER_URL is required for this test')
	const sandbox = createSandbox()
	sandbox.stub(mqttClient, 'connected').get(() => false)
	const publishAsync = sandbox.stub(mqttClient, 'publishAsync').resolves()
	sandbox.stub(logger, 'warning')

	try {
		await mqttInbox.publish(INSTITUTION_ID, PAYLOAD)
		assertEquals(publishAsync.called, false)
	} finally {
		sandbox.restore()
	}
})
