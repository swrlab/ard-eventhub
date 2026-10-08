import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { mqttUrlForNats, parseUserinfoUrl } from './url-auth.ts'

test('NATS URL userinfo is split off the server address', () => {
	const parsed = parseUserinfoUrl('nats://svc-sidecar:s3cret@127.0.0.1:4222')
	assertEquals(parsed.url, 'nats://127.0.0.1:4222')
	assertEquals(parsed.user, 'svc-sidecar')
	assertEquals(parsed.password, 's3cret')
	assertEquals(parsed.url.includes('@'), false)
})

test('percent-encoded password survives the split', () => {
	const parsed = parseUserinfoUrl('nats://svc-sidecar:p%40ss@broker.example:4222')
	assertEquals(parsed.url, 'nats://broker.example:4222')
	assertEquals(parsed.user, 'svc-sidecar')
	assertEquals(parsed.password, 'p@ss')
})

test('a URL without userinfo has empty credentials', () => {
	const parsed = parseUserinfoUrl('tls://127.0.0.1:4222')
	assertEquals(parsed.url, 'tls://127.0.0.1:4222')
	assertEquals(parsed.user, '')
	assertEquals(parsed.password, '')
})

test('MQTT default follows the NATS host and drops userinfo', () => {
	assertEquals(mqttUrlForNats('nats://svc-sidecar:s3cret@broker.example:4222'), 'mqtt://broker.example:1883')
	assertEquals(mqttUrlForNats('tls://127.0.0.1:4222'), 'mqtts://127.0.0.1:1883')
})

test('an unparseable value is left unchanged', () => {
	const parsed = parseUserinfoUrl('not a url')
	assertEquals(parsed.url, 'not a url')
	assertEquals(parsed.user, '')
	assertEquals(parsed.password, '')
})
