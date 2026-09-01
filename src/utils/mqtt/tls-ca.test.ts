import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from '@cross/test'
import { assertEquals, assertThrows } from '@std/assert'
import { mqttTlsConnectOptions, resolveMqttTlsCa } from './tls-ca.ts'

const PEM = `-----BEGIN CERTIFICATE-----
MIIB
-----END CERTIFICATE-----
`

test('resolveMqttTlsCa treats empty and whitespace as unset', () => {
	assertEquals(resolveMqttTlsCa(''), undefined)
	assertEquals(resolveMqttTlsCa('   '), undefined)
})

test('resolveMqttTlsCa accepts inline PEM', () => {
	const ca = resolveMqttTlsCa(PEM)
	assertEquals(ca?.toString(), PEM)
})

test('resolveMqttTlsCa reads a PEM file path', () => {
	const dir = mkdtempSync(join(tmpdir(), 'eventhub-mqtt-ca-'))
	const path = join(dir, 'ca.crt')
	try {
		writeFileSync(path, PEM)
		const ca = resolveMqttTlsCa(path)
		assertEquals(ca?.toString(), PEM)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})

test('resolveMqttTlsCa throws when the path is missing', () => {
	assertThrows(() => resolveMqttTlsCa('/tmp/eventhub-mqtt-ca-missing.crt'), Error)
})

test('mqttTlsConnectOptions omits ca when unset and includes it for PEM', () => {
	assertEquals(mqttTlsConnectOptions(''), {})
	assertEquals(mqttTlsConnectOptions(PEM).ca?.toString(), PEM)
})
