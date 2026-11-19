import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { parseNameList, switcherNames } from './env.ts'

test('name lists trim, lowercase, and drop blanks, duplicates, and non-labels', () => {
	assertEquals(parseNameList(' bad, MNZ ,stg '), ['bad', 'mnz', 'stg'])
	assertEquals(parseNameList('bad,bad,stg'), ['bad', 'stg'])
	assertEquals(parseNameList('bad, stg.evil, ,mnz'), ['bad', 'mnz'])
	assertEquals(parseNameList(''), [])
	assertEquals(parseNameList('  ,  '), [])
})

test('switcher names stay empty until configured and keep the current name selected', () => {
	assertEquals(switcherNames([], 'dev'), [])
	assertEquals(switcherNames(['dev', 'test', 'prod'], 'dev'), ['dev', 'test', 'prod'])
	assertEquals(switcherNames(['test', 'prod'], 'dev'), ['dev', 'test', 'prod'])
	assertEquals(switcherNames(['dev'], ''), ['dev'])
})
