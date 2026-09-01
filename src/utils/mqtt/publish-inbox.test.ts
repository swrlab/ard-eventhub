import { test } from '@cross/test'
import { logger } from '@frytg/logger'
import { assertEquals } from '@std/assert'
import { createSandbox } from 'sinon'
import { mqttClient } from './_client.ts'
import { inboxTopic, mqttInbox } from './publish-inbox.ts'

const INSTITUTION_ID = 'urn:ard:institution:a3004ff924ece1a2'
const PAYLOAD = { id: `${INSTITUTION_ID}-01`, event: 'de.ard.eventhub.v1.radio.track.playing' }

test('inboxTopic prefixes the institution URN', () => {
	assertEquals(inboxTopic(INSTITUTION_ID), `inbox/${INSTITUTION_ID}`)
})

test('mqttInbox.publish sends JSON to inbox/{institutionId} with QoS 1 and retain false', async () => {
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
