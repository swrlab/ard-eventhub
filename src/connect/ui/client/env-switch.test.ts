import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { envSwitchUrl } from './env-switch.ts'

const at = (hostname: string, port = '', search = '', hash = '') => ({
	protocol: 'https:' as const,
	hostname,
	port,
	pathname: '/cluster',
	search,
	hash,
})

test('env switch swaps zone or stage and keeps the domain, port, path, query, and hash', () => {
	assertEquals(
		envSwitchUrl(
			'stg',
			'dev',
			'mnz',
			'dev',
			at('eventhub-connect-stg-dev.swr.cn.ard.de', '', '?institution=abc', '#feed')
		),
		'https://eventhub-connect-mnz-dev.swr.cn.ard.de/cluster?institution=abc#feed'
	)
	assertEquals(
		envSwitchUrl('bad', 'dev', 'bad', 'prod', at('eventhub-connect-bad-dev.swr.ard', '8443')),
		'https://eventhub-connect-bad-prod.swr.ard:8443/cluster'
	)
	assertEquals(
		envSwitchUrl('bad', 'dev', 'mnz', 'test', at('eventhub-connect-bad-dev.swr.ard')),
		'https://eventhub-connect-mnz-test.swr.ard/cluster'
	)
})

test('env switch is null off the current name, for the current pair, or for a name that is not a label', () => {
	const here = at('eventhub-connect-stg-dev.swr.ard')
	assertEquals(envSwitchUrl('stg', 'dev', 'stg', 'dev', here), null)
	assertEquals(envSwitchUrl('stg', 'dev', 'mnz', 'dev', at('127.0.0.1')), null)
	assertEquals(envSwitchUrl('stg', 'dev', 'mnz', 'dev', at('localhost')), null)
	assertEquals(envSwitchUrl('bad', 'dev', 'mnz', 'dev', here), null)
	assertEquals(envSwitchUrl('stg', 'dev', 'mnz', 'dev', { ...here, protocol: 'javascript:' }), null)
	assertEquals(envSwitchUrl('stg', 'dev', 'MNZ', 'dev', here), null)
	assertEquals(envSwitchUrl('stg', 'dev', 'mnz.evil', 'dev', here), null)
	assertEquals(envSwitchUrl('', 'dev', 'mnz', 'dev', here), null)
})
