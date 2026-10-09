import type { RateWindow, TailClock, TailCloseReason } from '#types'
import { mqttTopicToNatsSubject } from '../../utils/nats/subjects.ts'

/**
 * Live-tail limits (RFC §14.4).
 * Idle is human presence: a click, key, scroll, or a return to a visible tab.
 * The page must not send a timer keepalive on the NATS socket. A hidden tab stops counting.
 * The 30 minute cap closes the socket even when someone is still interacting.
 * Stats stay on HTTP. The tail is a NATS WebSocket the browser opens itself.
 */

/** How often the boards poll. Independent of the tail socket. */
export const STATS_POLL_MS = 8_000

/** Close a tail with no presence beat for this long. */
export const TAIL_IDLE_MS = 2 * 60 * 1000

/** Close a tail this long after open, even if the operator is still there. */
export const TAIL_CAP_MS = 30 * 60 * 1000

/** Forwarded frames per tail per second. The rest are dropped and marked sampled. */
export const TAIL_MAX_PER_SECOND = 20

/** Narrower than `radio/#`. Cyclic `radio/+/data` must not be the default. */
export const DEFAULT_TAIL_FILTER = 'radio/+/track/playing'

/**
 * Close reason for a tail at `now`, or null when it may stay open.
 * The absolute cap wins over idle so a 30 minute session says so.
 * @param session - Open and last presence times
 * @param now - Current time in ms
 * @returns Close reason, or null
 */
export const evaluateTail = (session: TailClock, now: number): TailCloseReason | null => {
	if (now - session.openedAt >= TAIL_CAP_MS) return 'cap'
	if (now - session.lastBeatAt >= TAIL_IDLE_MS) return 'idle'
	return null
}

/**
 * Sentence the UI shows for a server-initiated close.
 * @param reason - Why the tail closed
 * @returns Operator-facing sentence
 */
export const tailCloseMessage = (reason: TailCloseReason): string => {
	switch (reason) {
		case 'idle':
			return 'live tail stopped after 2 minutes with no one watching'
		case 'cap':
			return 'live tail stopped after 30 minutes, resume'
		case 'client':
			return 'live tail closed'
		case 'nats':
			return 'live tail stopped, nats is unavailable'
		case 'denied':
			return 'live tail stopped, this user cannot subscribe to that subject'
	}
}

/**
 * Accept one inbound frame into the per-tail rate window.
 * @param rate - Window state
 * @param now - Current time in ms
 * @returns Next window, whether to forward, and whether this tail has dropped frames
 */
export const admitTailEvent = (
	rate: RateWindow,
	now: number
): { rate: RateWindow; forward: boolean; sampled: boolean } => {
	const fresh: RateWindow =
		now - rate.windowStart >= 1000 ? { windowStart: now, forwarded: 0, dropped: rate.dropped } : rate
	if (fresh.forwarded >= TAIL_MAX_PER_SECOND) {
		const next: RateWindow = { ...fresh, dropped: fresh.dropped + 1 }
		return { rate: next, forward: false, sampled: true }
	}
	const next: RateWindow = { ...fresh, forwarded: fresh.forwarded + 1 }
	return { rate: next, forward: true, sampled: next.dropped > 0 }
}

const RADIO_FILTER_RE = /^radio(\.[A-Za-z0-9_:*.>-]+)?$/

/**
 * Parse a tail filter written as an MQTT topic. Blank becomes the default.
 * The page subscribes the NATS subject. The browser user may only subscribe to verified `radio.>` events.
 * @param raw - Query value, or null
 * @returns The MQTT topic and NATS subject, or an error sentence
 */
export const parseTailFilter = (
	raw: string | null
): { ok: true; topic: string; subject: string } | { ok: false; error: string } => {
	const topic = raw?.trim() ? raw.trim() : DEFAULT_TAIL_FILTER
	if (topic.length > 256) return { ok: false, error: 'filter is too long' }
	const levels = topic.split('/')
	const hash = levels.indexOf('#')
	if (levels.some((level) => level.length === 0) || (hash !== -1 && hash !== levels.length - 1)) {
		return { ok: false, error: 'filter must be a radio topic' }
	}
	const subject = mqttTopicToNatsSubject(topic)
	if (!RADIO_FILTER_RE.test(subject)) {
		return { ok: false, error: 'filter must be a radio topic' }
	}
	return { ok: true, topic, subject }
}

/**
 * Match an IPv4 address against one exact address or CIDR.
 * @param ip - Peer address
 * @param cidr - Exact IP or `a.b.c.d/nn`
 * @returns True when the address is inside the range
 */
const matchCidr = (ip: string, cidr: string): boolean => {
	const slash = cidr.indexOf('/')
	if (slash === -1) return ip === cidr
	const range = cidr.slice(0, slash)
	const bits = Number(cidr.slice(slash + 1))
	if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false
	const ipInt = ipv4ToInt(ip)
	const rangeInt = ipv4ToInt(range)
	if (ipInt === null || rangeInt === null) return false
	if (bits === 0) return true
	const mask = (0xffffffff << (32 - bits)) >>> 0
	return (ipInt & mask) === (rangeInt & mask)
}

/**
 * Parse a dotted IPv4 address into an unsigned 32-bit int.
 * @param ip - Dotted quad
 * @returns The integer, or null
 */
const ipv4ToInt = (ip: string): number | null => {
	const parts = ip.split('.')
	if (parts.length !== 4) return null
	let value = 0
	for (const part of parts) {
		if (!/^\d{1,3}$/.test(part)) return null
		const octet = Number(part)
		if (octet > 255) return null
		value = (value << 8) + octet
	}
	return value >>> 0
}

/**
 * Source-CIDR allow-list. An empty list allows every peer (local dev).
 * Mapped IPv4 (`::ffff:10.1.2.3`) is compared as IPv4.
 * @param ip - Socket peer address
 * @param cidrs - Allow-list, possibly empty
 * @returns True when the request may proceed
 */
export const ipAllowed = (ip: string, cidrs: readonly string[]): boolean => {
	if (cidrs.length === 0) return true
	const normalized = ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip
	return cidrs.some((cidr) => matchCidr(normalized, cidr) || matchCidr(ip, cidr))
}

/**
 * Split `UI_ALLOW_CIDR` on commas.
 * @param raw - Env value
 * @returns CIDR entries
 */
export const parseAllowCidrs = (raw: string): string[] =>
	raw
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)
