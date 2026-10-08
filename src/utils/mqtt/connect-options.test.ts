import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { LOCAL_NATS_PASSWORD, LOCAL_NATS_USERS } from '../../connect/dev-users.ts'
import { ingestMqttConnectOptions } from './connect-options.ts'

test('ingest MQTT client is svc-ingest on MQTT v3.1.1', () => {
	const opts = ingestMqttConnectOptions('eventhub-ingest-test', LOCAL_NATS_USERS.svcIngest, LOCAL_NATS_PASSWORD)
	assertEquals(opts.clientId, 'eventhub-ingest-test')
	assertEquals(opts.protocolVersion, 4)
	assertEquals(opts.username, 'svc-ingest')
	assertEquals(opts.password, LOCAL_NATS_PASSWORD)
	assertEquals(opts.connectTimeout, 5_000)
})
