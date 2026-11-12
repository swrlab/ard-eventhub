import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { peerUrl } from './peer-url.ts'

const at = (hostname: string, port = '') => ({ protocol: 'https:', hostname, port, pathname: '/cluster' })

test('peer url swaps the first host label and keeps the domain', () => {
	const self = ['eventhub-connect-stg-dev']
	assertEquals(
		peerUrl('eventhub-connect-mnz-dev', self, at('eventhub-connect-stg-dev.swr.cn.ard.de')),
		'https://eventhub-connect-mnz-dev.swr.cn.ard.de/cluster'
	)
	assertEquals(
		peerUrl('eventhub-connect-bad-dev', self, at('eventhub-connect-stg-dev.swr.ard', '8443')),
		'https://eventhub-connect-bad-dev.swr.ard:8443/cluster'
	)
})

test('peer url is null off the naming scheme or for the current node', () => {
	const self = ['eventhub-connect-stg-dev']
	assertEquals(peerUrl('eventhub-connect-mnz-dev', ['nats-0'], at('127.0.0.1')), null)
	assertEquals(peerUrl('eventhub-connect-mnz-dev', self, at('localhost')), null)
	assertEquals(peerUrl('eventhub-connect-mnz-dev', self, at('connect.example.org')), null)
	assertEquals(peerUrl('eventhub-connect-stg-dev', self, at('eventhub-connect-stg-dev.swr.ard')), null)
})
