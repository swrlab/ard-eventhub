import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import {
	DEFAULT_TAIL_FILTER,
	TAIL_CAP_MS,
	TAIL_IDLE_MS,
	TAIL_MAX_PER_SECOND,
	admitTailEvent,
	evaluateTail,
	ipAllowed,
	parseAllowCidrs,
	parseTailFilter,
	tailCloseMessage,
} from './policy.ts'

test('tail closes on idle and the 30 minute cap wins when both are due', () => {
	assertEquals(evaluateTail({ openedAt: 0, lastBeatAt: 0 }, TAIL_IDLE_MS - 1), null)
	assertEquals(evaluateTail({ openedAt: 0, lastBeatAt: 0 }, TAIL_IDLE_MS), 'idle')
	assertEquals(evaluateTail({ openedAt: 0, lastBeatAt: TAIL_CAP_MS - 1 }, TAIL_CAP_MS), 'cap')
	assertEquals(tailCloseMessage('cap'), 'live tail stopped after 30 minutes, resume')
	assertEquals(tailCloseMessage('idle'), 'live tail stopped after 2 minutes with no one watching')
})

test('tail drops frames past the per-second cap and marks them sampled', () => {
	let rate = { windowStart: 1_000, forwarded: 0, dropped: 0 }
	for (let i = 0; i < TAIL_MAX_PER_SECOND; i++) {
		const decision = admitTailEvent(rate, 1_500)
		rate = decision.rate
		assertEquals(decision.forward, true)
		assertEquals(decision.sampled, false)
	}
	const dropped = admitTailEvent(rate, 1_500)
	assertEquals(dropped.forward, false)
	assertEquals(dropped.sampled, true)
	assertEquals(dropped.rate.dropped, 1)
	const later = admitTailEvent(dropped.rate, 2_600)
	assertEquals(later.forward, true)
	assertEquals(later.sampled, true)
})

test('tail filter accepts an MQTT topic and subscribes the NATS subject', () => {
	assertEquals(parseTailFilter(null), {
		ok: true,
		topic: DEFAULT_TAIL_FILTER,
		subject: 'radio.*.track.playing',
	})
	assertEquals(parseTailFilter('  '), {
		ok: true,
		topic: DEFAULT_TAIL_FILTER,
		subject: 'radio.*.track.playing',
	})
	assertEquals(parseTailFilter('radio/#'), { ok: true, topic: 'radio/#', subject: 'radio.>' })
	assertEquals(parseTailFilter('radio/urn:ard:permanent-livestream:abc/track/playing'), {
		ok: true,
		topic: 'radio/urn:ard:permanent-livestream:abc/track/playing',
		subject: 'radio.urn:ard:permanent-livestream:abc.track.playing',
	})
	assertEquals(parseTailFilter('radio.>').ok, false)
	assertEquals(parseTailFilter('radio.*.track.playing').ok, false)
	assertEquals(parseTailFilter('feedback/#').ok, false)
	assertEquals(parseTailFilter('inbox/#').ok, false)
	assertEquals(parseTailFilter('#').ok, false)
	assertEquals(parseTailFilter('$SYS/#').ok, false)
	assertEquals(parseTailFilter('radio/#/track').ok, false)
	assertEquals(parseTailFilter('radio/+/track.playing').ok, false)
})

test('source CIDR allow-list is empty-open and matches IPv4 ranges', () => {
	assertEquals(ipAllowed('10.1.2.3', []), true)
	assertEquals(ipAllowed('10.1.2.3', parseAllowCidrs('10.0.0.0/8, 192.168.1.9')), true)
	assertEquals(ipAllowed('192.168.1.9', parseAllowCidrs('10.0.0.0/8, 192.168.1.9')), true)
	assertEquals(ipAllowed('192.168.1.8', parseAllowCidrs('10.0.0.0/8')), false)
	assertEquals(ipAllowed('::ffff:10.9.0.1', parseAllowCidrs('10.0.0.0/8')), true)
	assertEquals(ipAllowed('10.1.2.3', ['0.0.0.0/0']), true)
})
