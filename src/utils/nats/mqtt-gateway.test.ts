import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { natsAccess } from './_client.ts'
import { INBOX_STREAM, PLUGINS_STREAM, VALIDATION_CONSUMER, ensureStreams } from './ensure-streams.ts'
import { inboxMqttTopic, inboxSubject } from './subjects.ts'
import { BROKER_PASSWORD, connectMqttUser, skipUnlessNats, tryConnectService } from './test-broker.ts'

const SWR_INSTITUTION_ID = 'urn:ard:institution:a3004ff924ece1a2'
const PUB_SWR = 'pub-swr-2026-06-26'

test('MQTT QoS 1 publish to inbox/{institutionId} arrives on inbox.{institutionId}', async () => {
	const nc = await tryConnectService()
	if (skipUnlessNats(nc)) {
		return
	}

	try {
		const streams = await ensureStreams(nc)
		assertEquals(streams.inbox, INBOX_STREAM)
		assertEquals(streams.plugins, PLUGINS_STREAM)
		assertEquals(streams.validation, VALIDATION_CONSUMER)

		const payload = { ping: 'nats-access', institutionId: SWR_INSTITUTION_ID }
		const received = new Promise<string>((resolve, reject) => {
			const sub = nc.subscribe(inboxSubject(SWR_INSTITUTION_ID), { max: 1 })
			const timer = setTimeout(() => {
				reject(new Error(`timeout waiting for ${inboxSubject(SWR_INSTITUTION_ID)}`))
			}, 5_000)
			void (async () => {
				for await (const msg of sub) {
					clearTimeout(timer)
					resolve(msg.string())
				}
			})()
		})

		const mqttClient = await connectMqttUser(PUB_SWR, BROKER_PASSWORD)
		try {
			await mqttClient.publishAsync(inboxMqttTopic(SWR_INSTITUTION_ID), JSON.stringify(payload), {
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
