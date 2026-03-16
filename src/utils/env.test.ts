import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { getEnv, getEnvBase64, getEnvBoolean, getEnvString, MissingEnvVarError, parseBase64, toBase64 } from './env.ts'

describe('no env values available', () => {
	it('should throw an error for missing required values', () => {
		expect(() => getEnv<string>('MISSING', { type: 'string', required: true })).toThrow(MissingEnvVarError)
	})
	it('should throw an error for missing required values (even with defaultValue)', () => {
		expect(() => getEnv<string>('MISSING', { type: 'string', required: true, defaultValue: 'hi' })).toThrow()
	})
	it('should return the defaultValue for optional values', () => {
		expect(getEnv<string>('MISSING', { type: 'string', required: false, defaultValue: 'def' })).toBe('def')
	})
	describe('functions with `required` set to `true` by default', () => {
		it('should throw an error for getEnvString when the value is missing', () => {
			expect(() => getEnvString('MISSING')).toThrow(MissingEnvVarError)
		})
		it('should throw an error for getEnvBase64 when the value is missing', () => {
			expect(() => getEnvBase64('MISSING')).toThrow(MissingEnvVarError)
		})
	})
	describe('functions with `required` set to `false` by default', () => {
		it('should return `undefined` for a missing boolean value', () => {
			expect(getEnvBoolean('MISSING')).toBeUndefined()
		})
		it('should return `undefined` for a missing general/string value', () => {
			expect(getEnv('MISSING')).toStrictEqual(undefined)
		})
	})
})

describe('mocked env values', () => {
	const mocked: Record<PropertyKey, string> = {
		FOO: 'BAR',
		BASE64: 'eyJkdHMiOnRydWV9',
		BASE64_BROKEN: 'asdf',
		EMPTY_JSON: '',
		BROKEN_JSON: '{ "asdf"',
	} as const

	beforeAll(() => {
		// @ts-expect-error - __BunTestMockEnv__ to mock values for `utils/env.ts`
		globalThis.__BunTestMockEnv__ = mocked
	})
	afterAll(() => {
		// clean up
		// @ts-expect-error - __BunTestMockEnv__ to mock values for `utils/env.ts`
		globalThis.__BunTestMockEnv__ = undefined
	})
	it('should throw an error for missing required values', () => {
		expect(() => getEnv<string>('MISSING', { type: 'string', required: true })).toThrow()
	})
	it('should not throw an error for existing values', () => {
		expect(getEnv<string>('FOO', { type: 'string', required: true })).toBe(mocked.FOO as string)
	})
	describe('getEnvBase64', () => {
		it('should have the value', () => {
			const value = getEnvBase64('BASE64')
			expect(value).toEqual({ dts: true })
		})
		it('should throw a SyntaxError for invalid json data', () => {
			expect(() => getEnvBase64('BASE64_BROKEN')).toThrow('JSON Parse error: Unexpected identifier')
			expect(() => getEnvBase64('BASE64_BROKEN')).toThrow('variable BASE64_BROKEN as')
		})
	})
	describe('getEnvJSON', () => {
		it('should throw a SyntaxError for an empty value', () => {
			expect(() => getEnvBase64('EMPTY_JSON')).toThrow('SyntaxError: JSON Parse error: Unexpected EOF')
		})
		it('should throw a SyntaxError for mal-formed json', () => {
			expect(() => getEnvBase64('BROKEN_JSON')).toThrow('SyntaxError: JSON Parse error: Unexpected identifier')
		})
	})
	describe('getEnvString', () => {
		it('should throw a SyntaxError for mal-formed json', () => {
			expect(() => getEnvString('MISSING_STR', undefined, false)).toThrow(
				'Missing default value for optional env string.'
			)
		})
	})
})

// base64 helper
describe('toBase64', () => {
	it('should encode a string to base64', () => {
		expect(toBase64('123456789')).toStrictEqual('MTIzNDU2Nzg5')
		expect(toBase64('hello')).toStrictEqual('aGVsbG8=')
	})
	it('should encode an empty string an empty string', () => {
		expect(toBase64('')).toStrictEqual('')
	})
	it('should throw a TypeError if a number is passed', () => {
		// @ts-expect-error - A number will not work.
		expect(() => toBase64(123456789)).toThrowError(TypeError)
	})
})

describe('parseBase64', () => {
	it('should decode base64', () => {
		expect(parseBase64('MTIzNDU2Nzg5')).toStrictEqual('123456789')
		expect(parseBase64('SGVsbG8gV29ybGQ=')).toStrictEqual('Hello World')
	})
	it('should decode an empty base64 to an empty string', () => {
		expect(parseBase64('')).toStrictEqual('')
	})
})
