import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { getSafeHeaders } from './get-safe-headers.ts'

test('getSafeHeaders redacts authorization from Headers', () => {
	const headers = new Headers({
		'content-type': 'application/json',
		authorization: 'Bearer secret-token',
	})

	assertEquals(getSafeHeaders(headers), {
		'content-type': 'application/json',
		authorization: 'hidden',
	})
})

test('getSafeHeaders redacts x-authorization from a record', () => {
	assertEquals(
		getSafeHeaders({
			'Content-Type': 'application/json',
			'X-Authorization': 'Bearer secret-token',
			'user-agent': 'test',
		}),
		{
			'Content-Type': 'application/json',
			'X-Authorization': 'hidden',
			'user-agent': 'test',
		}
	)
})

test('getSafeHeaders skips nullish record values', () => {
	assertEquals(
		getSafeHeaders({
			'content-type': 'application/json',
			authorization: undefined,
			'x-custom': null,
		}),
		{
			'content-type': 'application/json',
		}
	)
})
