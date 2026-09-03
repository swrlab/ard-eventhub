import process from 'node:process'
import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import mqtt from 'mqtt'
import { natsAccess } from './_client.ts'
import { INBOX_STREAM, PLUGINS_STREAM, SIDECAR_CONSUMER, ensureStreams } from './ensure-streams.ts'
import { inboxMqttTopic, inboxSubject } from './subjects.ts'

const INSTITUTION_ID = 'urn:ard:institution:a3004ff924ece1a2'
const NATS_SERVERS = process.env.NATS_URL?.trim() || 'nats://127.0.0.1:4222'
const MQTT_URL = process.env.NATS_MQTT_URL?.trim() || 'mqtt://127.0.0.1:1883'
const MQTT_V311 = 4
const REQUIRE_NATS = process.env.NATS_REQUIRE === 'true'

/**
 * Probe whether a NATS server is listening.
 * @returns Connected client, or null when the broker is down
 */
const tryConnectNats = async () => {
	try {
		return await natsAccess.connect({ servers: NATS_SERVERS })
	} catch {
		return null
	}
}

test('MQTT QoS 1 publish to inbox/{institutionId} arrives on inbox.{institutionId}', async () => {
	const nc = await tryConnectNats()
	if (!nc) {
		const message = 'nats not listening on 4222 — start with `just nats-up` (and `just mqtt-down` first)'
		if (REQUIRE_NATS) {
			throw new Error(message)
		}
		console.warn(`skip: ${message}`)
		return
	}

	try {
		const streams = await ensureStreams(nc)
		assertEquals(streams.inbox, INBOX_STREAM)
		assertEquals(streams.plugins, PLUGINS_STREAM)
		assertEquals(streams.sidecar, SIDECAR_CONSUMER)

		const payload = { ping: 'nats-access', institutionId: INSTITUTION_ID }
		const received = new Promise<string>((resolve, reject) => {
			const sub = nc.subscribe(inboxSubject(INSTITUTION_ID), { max: 1 })
			const timer = setTimeout(() => {
				reject(new Error(`timeout waiting for ${inboxSubject(INSTITUTION_ID)}`))
			}, 5_000)
			void (async () => {
				for await (const msg of sub) {
					clearTimeout(timer)
					resolve(msg.string())
				}
			})()
		})

		const mqttClient = await mqtt.connectAsync(MQTT_URL, {
			protocolVersion: MQTT_V311,
			clientId: `eventhub-nats-access-test-${process.pid}`,
			connectTimeout: 3_000,
		})
		try {
			await mqttClient.publishAsync(inboxMqttTopic(INSTITUTION_ID), JSON.stringify(payload), {
				qos: 1,
				retain: false,
			})
		} finally {
			await mqttClient.endAsync()
		}

		assertEquals(JSON.parse(await received), payload)
	} finally {
		await natsAccess.drain(nc)
	}
})
