import { test } from '@cross/test'
import { assertEquals, assertExists } from '@std/assert'
import { getConfigUser } from './get-user.ts'

test('getConfigUser finds lab@swr.de from users.json', () => {
	const user = getConfigUser('lab@swr.de')
	assertExists(user)
	assertEquals(user.email, 'lab@swr.de')
	assertExists(user.institutionId)
	assertExists(user.institution)
})

test('getConfigUser requires an exact email match', () => {
	assertEquals(getConfigUser('  Lab@Swr.de  '), undefined)
	assertEquals(getConfigUser('Lab@Swr.de'), undefined)
})

test('getConfigUser returns undefined for unknown emails', () => {
	assertEquals(getConfigUser('unknown-user@example.invalid'), undefined)
})
