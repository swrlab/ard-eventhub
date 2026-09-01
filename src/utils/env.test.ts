import process from 'node:process'
import { test, type TestContext } from '@cross/test'
import { assertEquals, assertStrictEquals, assertThrows } from '@std/assert'
import { getEnv, getEnvBase64, getEnvBoolean, parseBase64, toBase64 } from './env.ts'

const REQUIRED_MISSING_MESSAGE = 'env MISSING is required'

test('no env values available', async (t) => {
	await t.step('should throw an error for missing required values', () => {
		assertThrows(() => getEnv<string>('MISSING', { type: 'string', required: true }), Error, REQUIRED_MISSING_MESSAGE)
	})
	await t.step('should throw an error for missing required values (even with defaultValue)', () => {
		assertThrows(
			() => getEnv<string>('MISSING', { type: 'string', required: true, defaultValue: 'hi' }),
			Error,
			REQUIRED_MISSING_MESSAGE
		)
	})
	await t.step('should return the defaultValue for optional values', () => {
		assertStrictEquals(getEnv<string>('MISSING', { type: 'string', required: false, defaultValue: 'def' }), 'def')
	})
	await t.step('functions with `required` set to `true` by default', async (requiredTrue: TestContext) => {
		await requiredTrue.step('should throw an error for getEnvBase64 when the value is missing', () => {
			assertThrows(() => getEnvBase64('MISSING'), Error, REQUIRED_MISSING_MESSAGE)
		})
	})
	await t.step('functions with `required` set to `false` by default', async (requiredFalse: TestContext) => {
		await requiredFalse.step('should return `undefined` for a missing boolean value', () => {
			assertStrictEquals(getEnvBoolean('MISSING'), undefined)
		})
		await requiredFalse.step('should return `undefined` for a missing general/string value', () => {
			assertStrictEquals(getEnv('MISSING'), undefined)
		})
	})
})

test('mocked env values', async (t) => {
	const mocked: Record<string, string> = {
		FOO: 'BAR',
		BASE64: 'eyJkdHMiOnRydWV9',
		BASE64_BROKEN: 'asdf',
		EMPTY_JSON: '',
		BROKEN_JSON: '{ "asdf"',
	}

	const previous = new Map<string, string | undefined>()
	for (const key of Object.keys(mocked)) {
		previous.set(key, process.env[key])
		process.env[key] = mocked[key]
	}

	try {
		await t.step('should throw an error for missing required values', () => {
			assertThrows(() => getEnv<string>('MISSING', { type: 'string', required: true }), Error, REQUIRED_MISSING_MESSAGE)
		})
		await t.step('should not throw an error for existing values', () => {
			assertStrictEquals(getEnv<string>('FOO', { type: 'string', required: true }), mocked.FOO)
		})
		await t.step('getEnvBase64', async (base64: TestContext) => {
			await base64.step('should have the value', () => {
				const value = getEnvBase64('BASE64')
				assertEquals(value, { dts: true })
			})
			await base64.step('should throw for invalid json data', () => {
				assertThrows(() => getEnvBase64('BASE64_BROKEN'), Error, 'variable BASE64_BROKEN as')
			})
		})
		await t.step('getEnvJSON', async (json: TestContext) => {
			await json.step('should throw a SyntaxError for an empty value', () => {
				assertThrows(() => getEnvBase64('EMPTY_JSON'), Error, 'EMPTY_JSON')
			})
			await json.step('should throw a SyntaxError for mal-formed json', () => {
				assertThrows(() => getEnvBase64('BROKEN_JSON'), Error, 'BROKEN_JSON')
			})
		})
	} finally {
		for (const [key, value] of previous) {
			if (value === undefined) {
				delete process.env[key]
			} else {
				process.env[key] = value
			}
		}
	}
})

test('toBase64', async (t) => {
	await t.step('should encode a string to base64', () => {
		assertStrictEquals(toBase64('123456789'), 'MTIzNDU2Nzg5')
		assertStrictEquals(toBase64('hello'), 'aGVsbG8=')
	})
	await t.step('should encode an empty string an empty string', () => {
		assertStrictEquals(toBase64(''), '')
	})
	await t.step('should throw a TypeError if a non-string is passed', () => {
		assertThrows(
			// @ts-expect-error - A non-string will not work.
			() => toBase64({}),
			TypeError
		)
	})
})

test('parseBase64', async (t) => {
	await t.step('should decode base64', () => {
		assertStrictEquals(parseBase64('MTIzNDU2Nzg5'), '123456789')
		assertStrictEquals(parseBase64('SGVsbG8gV29ybGQ='), 'Hello World')
	})
	await t.step('should decode an empty base64 to an empty string', () => {
		assertStrictEquals(parseBase64(''), '')
	})
})
