import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { LOCAL_NATS_PASSWORD, LOCAL_NATS_USERS } from '../connect/dev-users.ts'
import {
	BRIDGE_CN_CLIENT_ID,
	BRIDGE_GCP_CLIENT_ID,
	cnInboxPublish,
	cnMqttConnectOptions,
	GCP_INBOX_FILTER,
	gcpInboxSubscribe,
	gcpMqttConnectOptions,
} from './clients.ts'

test('GCP MQTT client uses a fixed id, reconnects, and subscribes inbox/# at QoS 1', () => {
	const opts = gcpMqttConnectOptions('')
	assertEquals(opts.clientId, BRIDGE_GCP_CLIENT_ID)
	assertEquals(opts.clientId, 'eventhub-bridge')
	assertEquals((opts.reconnectPeriod ?? 0) > 0, true)
	assertEquals(GCP_INBOX_FILTER, 'inbox/#')
	assertEquals(gcpInboxSubscribe.qos, 1)
})

test('CN MQTT client is svc-bridge, reconnects, and publishes QoS 1 without retain', () => {
	const opts = cnMqttConnectOptions('', LOCAL_NATS_USERS.svcBridge, LOCAL_NATS_PASSWORD)
	assertEquals(opts.clientId, BRIDGE_CN_CLIENT_ID)
	assertEquals(opts.username, 'svc-bridge')
	assertEquals(opts.password, LOCAL_NATS_PASSWORD)
	assertEquals((opts.reconnectPeriod ?? 0) > 0, true)
	assertEquals(cnInboxPublish.qos, 1)
	assertEquals(cnInboxPublish.retain, false)
})
