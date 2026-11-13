import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { resolveHost } from './hosts.ts'

const HOSTS = {
	'acme-host-a': { server: 's0000001', aliases: ['a'] },
	'acme-host-b': { server: 's0000002' },
}

test('resolveHost accepts the friendly name or an alias', () => {
	assertEquals(resolveHost(HOSTS, 'acme-host-a'), 'acme-host-a')
	assertEquals(resolveHost(HOSTS, 'a'), 'acme-host-a')
	assertEquals(resolveHost(HOSTS, 'acme-host-b'), 'acme-host-b')
})

test('resolveHost ignores server numbers and unknown names', () => {
	assertEquals(resolveHost(HOSTS, 's0000001'), undefined)
	assertEquals(resolveHost(HOSTS, 'nope'), undefined)
})
