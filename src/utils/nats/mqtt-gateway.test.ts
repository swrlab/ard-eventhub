import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { LOCAL_NATS_PASSWORD, LOCAL_NATS_USERS, SWR_INSTITUTION_ID } from '../../connect/dev-users.ts'
import { natsAccess } from './_client.ts'
import { INBOX_STREAM, PLUGINS_STREAM, SIDECAR_CONSUMER, ensureStreams } from './ensure-streams.ts'
import { inboxMqttTopic, inboxSubject } from './subjects.ts'
import { connectMqttUser, skipUnlessNats, tryConnectSidecar } from './test-broker.ts'

test('MQTT QoS 1 publish to inbox/{institutionId} arrives on inbox.{institutionId}', async () => {
	const nc = await tryConnectSidecar()
	if (skipUnlessNats(nc)) {
		return
	}

	try {
		const streams = await ensureStreams(nc)
		assertEquals(streams.inbox, INBOX_STREAM)
		assertEquals(streams.plugins, PLUGINS_STREAM)
		assertEquals(streams.sidecar, SIDECAR_CONSUMER)

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

		const mqttClient = await connectMqttUser(LOCAL_NATS_USERS.pubSwr, LOCAL_NATS_PASSWORD)
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
