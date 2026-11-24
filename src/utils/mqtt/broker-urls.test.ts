import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { isMqttBrokerConfigured, mqttBrokerClientOptions, parseMqttBrokerList } from './broker-urls.ts'

const BAD = 'mqtts://eventhub-connect-bad-prod.example:8883'
const MNZ = 'mqtts://eventhub-connect-mnz-prod.example:8883'
const STG = 'mqtts://eventhub-connect-stg-prod.example:8883'

test('isMqttBrokerConfigured treats a blank URL as Pub/Sub only', () => {
	assertEquals(isMqttBrokerConfigured(''), false)
	assertEquals(isMqttBrokerConfigured('   '), false)
	assertEquals(isMqttBrokerConfigured(','), false)
	assertEquals(isMqttBrokerConfigured('mqtt://127.0.0.1:1883'), true)
	assertEquals(isMqttBrokerConfigured(`${BAD},${MNZ}`), true)
})

test('a single broker URL stays one server and keeps its userinfo', () => {
	const list = parseMqttBrokerList('mqtt://svc-ingest:s3cret@127.0.0.1:1883')
	assertEquals(list.servers, [{ protocol: 'mqtt', host: '127.0.0.1', port: 1883 }])
	assertEquals(list.user, 'svc-ingest')
	assertEquals(list.password, 's3cret')
	assertEquals(list.rejectedHosts, [])
	assertEquals(list.invalidCount, 0)
	assertEquals(mqttBrokerClientOptions(list).servers, list.servers)
	assertEquals(mqttBrokerClientOptions(list).username, 'svc-ingest')
	assertEquals(mqttBrokerClientOptions(list).password, 's3cret')
})

test('comma-separated URLs are a failover list with one shared account', () => {
	const list = parseMqttBrokerList(`mqtts://svc-ingest:s3cret@eventhub-connect-bad-prod.example:8883, ${MNZ}, ${STG}`)
	assertEquals(list.servers, [
		{ protocol: 'mqtts', host: 'eventhub-connect-bad-prod.example', port: 8883 },
		{ protocol: 'mqtts', host: 'eventhub-connect-mnz-prod.example', port: 8883 },
		{ protocol: 'mqtts', host: 'eventhub-connect-stg-prod.example', port: 8883 },
	])
	assertEquals(list.user, 'svc-ingest')
	assertEquals(list.password, 's3cret')
	assertEquals(list.rejectedHosts, [])
})

test('mqtts without a port defaults to 8883 and mqtt to 1883', () => {
	const list = parseMqttBrokerList('mqtts://bad.example,mqtt://127.0.0.1')
	assertEquals(list.servers, [
		{ protocol: 'mqtts', host: 'bad.example', port: 8883 },
		{ protocol: 'mqtt', host: '127.0.0.1', port: 1883 },
	])
})

test('a percent-encoded comma stays inside the password', () => {
	const list = parseMqttBrokerList('mqtt://svc-ingest:p%2Css@bad.example:8883,mqtts://mnz.example:8883')
	assertEquals(list.password, 'p,ss')
	assertEquals(list.servers.length, 2)
})

test('a host with different userinfo is dropped', () => {
	const list = parseMqttBrokerList('mqtts://svc-ingest:one@bad.example:8883,mqtts://svc-ingest:two@mnz.example:8883')
	assertEquals(list.servers, [{ protocol: 'mqtts', host: 'bad.example', port: 8883 }])
	assertEquals(list.password, 'one')
	assertEquals(list.rejectedHosts, ['mqtts://mnz.example:8883'])
})

test('a repeated host is kept once', () => {
	const list = parseMqttBrokerList(`${BAD},${BAD}`)
	assertEquals(list.servers.length, 1)
})

test('entries that are not mqtt URLs are counted and skipped', () => {
	const list = parseMqttBrokerList(`not a url,https://example.com,${BAD}`)
	assertEquals(list.servers, [{ protocol: 'mqtts', host: 'eventhub-connect-bad-prod.example', port: 8883 }])
	assertEquals(list.invalidCount, 2)
	assertEquals(list.rejectedHosts, [])
})
