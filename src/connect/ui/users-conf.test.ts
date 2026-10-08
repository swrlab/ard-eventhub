import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from '@cross/test'
import { assert, assertEquals } from '@std/assert'
import { buildUserRows, parseUsersConf } from './users-conf.ts'

const USERS_FILE = join(import.meta.dir, '../../../infra/kubernetes/components/users/nats-users.conf')

test('users file yields names, issue dates, and institutions, never the bcrypt hash', () => {
	const users = parseUsersConf(readFileSync(USERS_FILE, 'utf8'))
	const swr = users.find((user) => user.username === 'pub-swr-2026-06-26')
	const shared = users.find((user) => user.username === 'pub-shared-playout-2026-06-26')
	const operator = users.find((user) => user.username === 'svc-operator')
	assert(swr)
	assert(shared)
	assert(operator)
	assertEquals(swr.issued, '2026-06-26')
	assertEquals(swr.institutions, ['urn:ard:institution:a3004ff924ece1a2'])
	assertEquals(shared.institutions, ['urn:ard:institution:a3004ff924ece1a2', 'urn:ard:institution:b71c0e4d9a25f338'])
	const ui = users.find((user) => user.username === 'sub-ui')
	assert(ui)
	assertEquals(ui.issued, null)
	assertEquals(ui.connectionTypes, ['WEBSOCKET'])
	assertEquals(ui.allows, ['radio.>'])
	assertEquals(operator.connectionTypes, ['STANDARD'])
	assert(operator.allows.includes('radio.>'))
	assertEquals(JSON.stringify(users).includes('$2a$'), false)
	assertEquals(JSON.stringify(users).includes('password'), false)
})

test('a connected user missing from the file is still listed, oldest issue date first', () => {
	const rows = buildUserRows(
		[
			{
				username: 'pub-swr-2026-08-01',
				issued: '2026-08-01',
				institutions: [],
				allows: [],
				connectionTypes: ['MQTT'],
			},
			{
				username: 'pub-br-2026-01-02',
				issued: '2026-01-02',
				institutions: [],
				allows: [],
				connectionTypes: [],
			},
		],
		[
			{
				server: 'nats-0',
				cid: 1,
				ip: '10.0.0.2',
				user: 'pub-br-2026-01-02',
				name: '',
				connectedAt: null,
				lastActivity: null,
				subscriptions: [],
				mqttClient: null,
			},
			{
				server: 'nats-1',
				cid: 2,
				ip: '10.0.0.3',
				user: 'pub-extra-2026-03-03',
				name: '',
				connectedAt: null,
				lastActivity: null,
				subscriptions: [],
				mqttClient: null,
			},
		]
	)
	assertEquals(
		rows.map((row) => `${row.username}:${row.connections}`),
		['pub-br-2026-01-02:1', 'pub-extra-2026-03-03:1', 'pub-swr-2026-08-01:0']
	)
})
