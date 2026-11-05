import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { ingestMqttConnectOptions } from './connect-options.ts'

test('ingest MQTT options leave credentials to the broker URL', () => {
	const opts = ingestMqttConnectOptions('eventhub-ingest-test')
	assertEquals(opts.clientId, 'eventhub-ingest-test')
	assertEquals(opts.protocolVersion, 4)
	assertEquals(opts.username, undefined)
	assertEquals(opts.password, undefined)
	assertEquals(opts.connectTimeout, 5_000)
})
