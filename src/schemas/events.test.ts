import { test } from '@cross/test'
import { assertEquals, assertStrictEquals } from '@std/assert'
import { z } from 'zod'
import {
	connectEventNames,
	eventNames,
	eventV1RadioControlPostBody,
	eventV1RadioDataPostBody,
	httpsEventNames,
	isConnectEventName,
	services,
	servicesUrn,
} from './events.ts'

const urnService = {
	id: 'urn:ard:permanent-livestream:49267f7d67be180d',
	publisherId: 'urn:ard:publisher:75dbb3dace15f610',
	institutionId: 'urn:ard:institution:a3004ff924ece1a2',
}

const legacyService = {
	type: 'PermanentLivestream',
	externalId: 'crid://swr.de/123450',
	publisherId: '248000',
}

const controlBody = {
	event: 'de.ard.eventhub.v1.radio.control' as const,
	start: '2026-05-27T16:03:00+01:00',
	name: 'TA',
	state: true,
	services: [urnService],
}

const dataBody = {
	event: 'de.ard.eventhub.v1.radio.data' as const,
	start: '2020-01-19T06:00:00+01:00',
	cycle: 8,
	data: [
		{ type: 'radiotext' as const, id: 0 as const, value: 'Sie hören die ARD Popnacht' },
		{ type: 'dynlabel' as const, id: 0 as const, value: 'Sie hören die ARD Popnacht' },
		{ type: 'rtdlplus' as const, id: 32, description: 'PROGRAM.Stationname long', value: 'SWR 3' },
	],
	services: [urnService],
}

test('eventNames lists HTTPS and Connect classes', () => {
	assertEquals(
		[...eventNames],
		[
			'de.ard.eventhub.v1.radio.track.playing',
			'de.ard.eventhub.v1.radio.track.next',
			'de.ard.eventhub.v1.radio.control',
			'de.ard.eventhub.v1.radio.data',
		]
	)
	assertEquals([...httpsEventNames], ['de.ard.eventhub.v1.radio.track.playing', 'de.ard.eventhub.v1.radio.track.next'])
	assertEquals([...connectEventNames], ['de.ard.eventhub.v1.radio.control', 'de.ard.eventhub.v1.radio.data'])
	assertStrictEquals(isConnectEventName('de.ard.eventhub.v1.radio.control'), true)
	assertStrictEquals(isConnectEventName('de.ard.eventhub.v1.radio.data'), true)
	assertStrictEquals(isConnectEventName('de.ard.eventhub.v1.radio.track.playing'), false)
})

test('servicesUrn accepts a valid URN triple', () => {
	const result = servicesUrn.safeParse(urnService)
	assertStrictEquals(result.success, true)
})

test('servicesUrn rejects missing institutionId', () => {
	const result = servicesUrn.safeParse({
		id: urnService.id,
		publisherId: urnService.publisherId,
	})
	assertStrictEquals(result.success, false)
})

test('servicesUrn rejects a Core-ID publisherId', () => {
	const result = servicesUrn.safeParse({
		...urnService,
		publisherId: '248000',
	})
	assertStrictEquals(result.success, false)
})

test('servicesUrn rejects a CRID-only legacy entry', () => {
	const result = servicesUrn.safeParse(legacyService)
	assertStrictEquals(result.success, false)
})

test('services requires id, or externalId plus type, on HTTPS input', () => {
	const validLegacy = services.safeParse(legacyService)
	assertStrictEquals(validLegacy.success, true)

	const validIdOnly = services.safeParse({
		id: urnService.id,
		publisherId: legacyService.publisherId,
	})
	assertStrictEquals(validIdOnly.success, true)

	const validBoth = services.safeParse({
		...legacyService,
		id: urnService.id,
	})
	assertStrictEquals(validBoth.success, true)

	const cridWithoutType = services.safeParse({
		externalId: legacyService.externalId,
		publisherId: legacyService.publisherId,
	})
	const typeWithoutCrid = services.safeParse({
		type: legacyService.type,
		publisherId: legacyService.publisherId,
	})
	assertStrictEquals(cridWithoutType.success, false)
	assertStrictEquals(typeWithoutCrid.success, false)
})

test('services accepts a payload without institutionId and keeps it optional', () => {
	const result = services.safeParse(legacyService)
	assertStrictEquals(result.success, true)
	if (result.success) {
		assertEquals(result.data.institutionId, undefined)
	}
})

test('eventV1RadioControlPostBody accepts a valid control event', () => {
	const result = eventV1RadioControlPostBody.safeParse(controlBody)
	assertStrictEquals(result.success, true)
})

test('eventV1RadioControlPostBody accepts a non-standard control name', () => {
	const result = eventV1RadioControlPostBody.safeParse({ ...controlBody, name: 'CustomBit' })
	assertStrictEquals(result.success, true)
})

test('eventV1RadioControlPostBody rejects a missing state', () => {
	const { state: _state, ...withoutState } = controlBody
	const result = eventV1RadioControlPostBody.safeParse(withoutState)
	assertStrictEquals(result.success, false)
})

test('eventV1RadioControlPostBody rejects a missing name', () => {
	const { name: _name, ...withoutName } = controlBody
	const result = eventV1RadioControlPostBody.safeParse(withoutName)
	assertStrictEquals(result.success, false)
})

test('eventV1RadioControlPostBody rejects legacy CRID services', () => {
	const result = eventV1RadioControlPostBody.safeParse({
		...controlBody,
		services: [legacyService],
	})
	assertStrictEquals(result.success, false)
})

test('eventV1RadioDataPostBody accepts a mixed data array', () => {
	const result = eventV1RadioDataPostBody.safeParse(dataBody)
	assertStrictEquals(result.success, true)
})

test('eventV1RadioDataPostBody rejects cycle 0', () => {
	const result = eventV1RadioDataPostBody.safeParse({ ...dataBody, cycle: 0 })
	assertStrictEquals(result.success, false)
})

test('eventV1RadioDataPostBody rejects a non-integer cycle', () => {
	const result = eventV1RadioDataPostBody.safeParse({ ...dataBody, cycle: 8.5 })
	assertStrictEquals(result.success, false)
})

test('eventV1RadioDataPostBody rejects legacy CRID services', () => {
	const result = eventV1RadioDataPostBody.safeParse({
		...dataBody,
		services: [legacyService],
	})
	assertStrictEquals(result.success, false)
})

test('rtdlplus id 53 is accepted', () => {
	const result = eventV1RadioDataPostBody.safeParse({
		...dataBody,
		data: [{ type: 'rtdlplus', id: 53, value: 'vote center' }],
	})
	assertStrictEquals(result.success, true)
})

test('rtdlplus id 54 is rejected', () => {
	const result = eventV1RadioDataPostBody.safeParse({
		...dataBody,
		data: [{ type: 'rtdlplus', id: 54, value: 'reserved' }],
	})
	assertStrictEquals(result.success, false)
})

test('rtdlplus id 55 is rejected', () => {
	const result = eventV1RadioDataPostBody.safeParse({
		...dataBody,
		data: [{ type: 'rtdlplus', id: 55, value: 'reserved' }],
	})
	assertStrictEquals(result.success, false)
})

test('rtdlplus id 56 is accepted', () => {
	const result = eventV1RadioDataPostBody.safeParse({
		...dataBody,
		data: [{ type: 'rtdlplus', id: 56, value: 'private' }],
	})
	assertStrictEquals(result.success, true)
})

test('rtdlplus id 63 is accepted', () => {
	const result = eventV1RadioDataPostBody.safeParse({
		...dataBody,
		data: [{ type: 'rtdlplus', id: 63, value: 'get data' }],
	})
	assertStrictEquals(result.success, true)
})

test('rtdlplus id 64 is rejected', () => {
	const result = eventV1RadioDataPostBody.safeParse({
		...dataBody,
		data: [{ type: 'rtdlplus', id: 64, value: 'out of range' }],
	})
	assertStrictEquals(result.success, false)
})

test('rtdlplus id -1 is rejected', () => {
	const result = eventV1RadioDataPostBody.safeParse({
		...dataBody,
		data: [{ type: 'rtdlplus', id: -1, value: 'out of range' }],
	})
	assertStrictEquals(result.success, false)
})

test('radiotext and dynlabel accept id 0', () => {
	const radiotext = eventV1RadioDataPostBody.safeParse({
		...dataBody,
		data: [{ type: 'radiotext', id: 0, value: 'text' }],
	})
	const dynlabel = eventV1RadioDataPostBody.safeParse({
		...dataBody,
		data: [{ type: 'dynlabel', id: 0, value: 'label' }],
	})
	assertStrictEquals(radiotext.success, true)
	assertStrictEquals(dynlabel.success, true)
})

test('radiotext and dynlabel reject a non-zero id', () => {
	const radiotext = eventV1RadioDataPostBody.safeParse({
		...dataBody,
		data: [{ type: 'radiotext', id: 32, value: 'text' }],
	})
	const dynlabel = eventV1RadioDataPostBody.safeParse({
		...dataBody,
		data: [{ type: 'dynlabel', id: 32, value: 'label' }],
	})
	assertStrictEquals(radiotext.success, false)
	assertStrictEquals(dynlabel.success, false)
})

test('rtdlplus id 0 (DUMMY_CLASS) is accepted', () => {
	const result = eventV1RadioDataPostBody.safeParse({
		...dataBody,
		data: [{ type: 'rtdlplus', id: 0, value: 'dummy' }],
	})
	assertStrictEquals(result.success, true)
})
