import { test } from '@cross/test'
import { assertEquals, assertThrows } from '@std/assert'
import { NATS_SUB_USAGE, parseNatsSubArgs } from './nats-sub-args.ts'

const INSTITUTION_ID = 'urn:ard:institution:a3004ff924ece1a2'

test('parseNatsSubArgs treats a positional as one institution inbox', () => {
	assertEquals(parseNatsSubArgs([INSTITUTION_ID]), {
		kind: 'institution',
		institutionId: INSTITUTION_ID,
		subject: `inbox.${INSTITUTION_ID}`,
	})
})

test('parseNatsSubArgs maps --all and -a to inbox.>', () => {
	assertEquals(parseNatsSubArgs(['--all']), { kind: 'all', subject: 'inbox.>' })
	assertEquals(parseNatsSubArgs(['-a']), { kind: 'all', subject: 'inbox.>' })
})

test('parseNatsSubArgs rejects --all combined with an institution id', () => {
	assertThrows(() => parseNatsSubArgs(['--all', INSTITUTION_ID]), Error, 'cannot be combined')
})

test('parseNatsSubArgs rejects missing target, extra args, and unknown flags', () => {
	assertThrows(() => parseNatsSubArgs([]), Error, NATS_SUB_USAGE)
	assertThrows(() => parseNatsSubArgs([INSTITUTION_ID, 'extra']), Error, NATS_SUB_USAGE)
	assertThrows(() => parseNatsSubArgs(['--help']), Error, NATS_SUB_USAGE)
	assertThrows(() => parseNatsSubArgs(['--wildcard']), Error, 'unknown flag')
})
