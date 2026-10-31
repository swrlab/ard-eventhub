import { test } from '@cross/test'
import { assertEquals, assertThrows } from '@std/assert'
import { MQTT_SUB_USAGE, parseMqttSubArgs } from './mqtt-sub-args.ts'

const INSTITUTION_ID = 'urn:ard:institution:a3004ff924ece1a2'

test('parseMqttSubArgs treats a positional as one institution inbox', () => {
	assertEquals(parseMqttSubArgs([INSTITUTION_ID]), {
		kind: 'institution',
		institutionId: INSTITUTION_ID,
		topic: `inbox/${INSTITUTION_ID}`,
	})
})

test('parseMqttSubArgs maps --all and -a to inbox/#', () => {
	assertEquals(parseMqttSubArgs(['--all']), { kind: 'all', topic: 'inbox/#' })
	assertEquals(parseMqttSubArgs(['-a']), { kind: 'all', topic: 'inbox/#' })
})

test('parseMqttSubArgs rejects --all combined with an institution id', () => {
	assertThrows(() => parseMqttSubArgs(['--all', INSTITUTION_ID]), Error, 'cannot be combined')
})

test('parseMqttSubArgs rejects missing target, extra args, and unknown flags', () => {
	assertThrows(() => parseMqttSubArgs([]), Error, MQTT_SUB_USAGE)
	assertThrows(() => parseMqttSubArgs([INSTITUTION_ID, 'extra']), Error, MQTT_SUB_USAGE)
	assertThrows(() => parseMqttSubArgs(['--help']), Error, MQTT_SUB_USAGE)
	assertThrows(() => parseMqttSubArgs(['--wildcard']), Error, 'unknown flag')
})
