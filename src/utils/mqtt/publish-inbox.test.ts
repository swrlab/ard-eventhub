import type { MqttClient } from 'mqtt'
import { test } from '@cross/test'
import { logger } from '@frytg/logger'
import { assertEquals } from '@std/assert'
import { createSandbox } from 'sinon'
import { mqttClientCache, mqttFactory, mqttSettings } from './_client.ts'
import { inboxTopic, mqttInbox } from './publish-inbox.ts'

const INSTITUTION_ID = 'urn:ard:institution:a3004ff924ece1a2'
const PAYLOAD = { id: `${INSTITUTION_ID}-01`, event: 'de.ard.eventhub.v1.radio.track.playing' }

/**
 * Build a stub mqtt.js client that records publishes.
 * @param params - Connection and publish behaviour
 * @returns Fake client
 */
const fakeMqttClient = (params: { connected?: boolean; publishError?: Error } = {}) => {
	const publishCalls: Array<{ topic: string; message: string; opts: { qos: number; retain: boolean } }> = []

	const client: {
		connected: boolean
		publishCalls: typeof publishCalls
		publish: (
			topic: string,
			message: string | Buffer,
			opts: { qos: number; retain: boolean },
			callback?: (error?: Error) => void
		) => void
		once: (event: string, handler: (error: Error) => void) => unknown
		off: () => unknown
		end: () => unknown
	} = {
		connected: params.connected ?? true,
		publishCalls,
		publish: (topic, message, opts, callback) => {
			publishCalls.push({ topic, message: String(message), opts })
			callback?.(params.publishError)
		},
		once: () => client,
		off: () => client,
		end: () => client,
	}

	return client
}

test('inboxTopic prefixes the institution URN', () => {
	assertEquals(inboxTopic(INSTITUTION_ID), `inbox/${INSTITUTION_ID}`)
})

test('mqttInbox.publish sends JSON to inbox/{institutionId} with QoS 1 and retain false', async () => {
	const sandbox = createSandbox()
	const client = fakeMqttClient()
	sandbox.stub(mqttSettings, 'brokerUrl').returns('mqtt://127.0.0.1:1883')
	sandbox.stub(mqttFactory, 'connect').returns(client as unknown as MqttClient)
	mqttClientCache.current = undefined

	try {
		await mqttInbox.publish(INSTITUTION_ID, PAYLOAD)

		assertEquals(client.publishCalls.length, 1)
		assertEquals(client.publishCalls[0]?.topic, `inbox/${INSTITUTION_ID}`)
		assertEquals(client.publishCalls[0]?.message, JSON.stringify(PAYLOAD))
		assertEquals(client.publishCalls[0]?.opts, { qos: 1, retain: false })
	} finally {
		mqttClientCache.current = undefined
		sandbox.restore()
	}
})

test('mqttInbox.publish does not throw when the broker publish fails', async () => {
	const sandbox = createSandbox()
	const client = fakeMqttClient({ publishError: new Error('broker down') })
	sandbox.stub(mqttSettings, 'brokerUrl').returns('mqtt://127.0.0.1:1883')
	sandbox.stub(mqttFactory, 'connect').returns(client as unknown as MqttClient)
	sandbox.stub(logger, 'warning')
	mqttClientCache.current = undefined

	try {
		await mqttInbox.publish(INSTITUTION_ID, PAYLOAD)
	} finally {
		mqttClientCache.current = undefined
		sandbox.restore()
	}
})

test('mqttInbox.publish does not throw when connect fails', async () => {
	const sandbox = createSandbox()
	const client = fakeMqttClient({ connected: false })
	client.once = (event: string, handler: (error: Error) => void) => {
		if (event === 'error') handler(new Error('econnrefused'))
		return client
	}
	sandbox.stub(mqttSettings, 'brokerUrl').returns('mqtt://127.0.0.1:1883')
	sandbox.stub(mqttFactory, 'connect').returns(client as unknown as MqttClient)
	sandbox.stub(logger, 'warning')
	mqttClientCache.current = undefined

	try {
		await mqttInbox.publish(INSTITUTION_ID, PAYLOAD)
	} finally {
		mqttClientCache.current = undefined
		sandbox.restore()
	}
})
