import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { LOCAL_NATS_PASSWORD, LOCAL_NATS_USERS, SWR_INSTITUTION_ID } from '../connect/dev-users.ts'
import { natsAccess } from '../utils/nats/_client.ts'
import { inboxMqttTopic, inboxSubject } from '../utils/nats/subjects.ts'
import { connectMqttUser, skipUnlessNats, tryConnectSidecar } from '../utils/nats/test-broker.ts'
import { cnInboxPublish } from './clients.ts'
import { relayInbox } from './relay.ts'

test('GCP MQTT inbox payload arrives byte-identical on the CN MQTT inbox as svc-bridge', async () => {
	const sidecar = await tryConnectSidecar()
	if (skipUnlessNats(sidecar)) {
		return
	}

	const cn = await connectMqttUser(LOCAL_NATS_USERS.svcBridge, LOCAL_NATS_PASSWORD)

	try {
		const payload = new Uint8Array([123, 34, 112, 105, 110, 103, 34, 58, 49, 125, 0, 255])
		const seen = new Promise<Uint8Array>((resolve, reject) => {
			const sub = sidecar.subscribe(inboxSubject(SWR_INSTITUTION_ID), { max: 1 })
			const timer = setTimeout(() => reject(new Error('timeout waiting for bridged inbox')), 5_000)
			void (async () => {
				for await (const msg of sub) {
					clearTimeout(timer)
					resolve(msg.data)
				}
			})()
		})

		assertEquals(
			await relayInbox(inboxMqttTopic(SWR_INSTITUTION_ID), payload, async (topic, bytes) => {
				await cn.publishAsync(topic, bytes, cnInboxPublish)
			}),
			'relayed'
		)
		assertEquals(Uint8Array.from(await seen), payload)
	} finally {
		await cn.endAsync()
		await natsAccess.drain(sidecar)
	}
})
