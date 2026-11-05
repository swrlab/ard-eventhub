import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { resolveNatsAuth } from './env.ts'

test('NATS credentials come from NATS_USER and NATS_PASSWORD, not the URL', () => {
	const auth = resolveNatsAuth('nats://from-url:s3cret@broker.example:4222', 'svc-eventhub-connect', 'env-pass')
	assertEquals(auth.url, 'nats://broker.example:4222')
	assertEquals(auth.user, 'svc-eventhub-connect')
	assertEquals(auth.password, 'env-pass')
	assertEquals(auth.url.includes('@'), false)
})

test('a URL without userinfo keeps the host and trims the env credentials', () => {
	const auth = resolveNatsAuth('tls://127.0.0.1:4222', ' svc-eventhub-connect ', ' env-pass ')
	assertEquals(auth.url, 'tls://127.0.0.1:4222')
	assertEquals(auth.user, 'svc-eventhub-connect')
	assertEquals(auth.password, 'env-pass')
})

test('empty credentials stay empty', () => {
	const auth = resolveNatsAuth('nats://127.0.0.1:4222', '', '')
	assertEquals(auth.user, '')
	assertEquals(auth.password, '')
})
