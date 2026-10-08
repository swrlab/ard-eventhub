import type { NatsConnection, Subscription } from '@nats-io/transport-node'
import { logger } from '@frytg/logger'
import {
	TAIL_CAP_MS,
	TAIL_CLOSE_CODE,
	TAIL_IDLE_MS,
	admitTailEvent,
	evaluateTail,
	tailCloseMessage,
	tailSlotFree,
	type TailCloseReason,
} from './policy.ts'

const source = 'connect.ui'

type TailSend = (frame: string) => void
type TailClose = (code: number, reason: string) => void

type Client = {
	id: number
	filter: string
	ip: string
	openedAt: number
	lastBeatAt: number
	rate: { windowStart: number; forwarded: number; dropped: number }
	lastDropNotice: number
	send: TailSend
	close: TailClose
}

type Fan = {
	filter: string
	sub: Subscription
	clients: Set<Client>
}

export type TailOpen = {
	id: number
	filter: string
	ip: string
	send: TailSend
	close: TailClose
}

export type TailHub = {
	open: (input: TailOpen) => void
	beat: (id: number, now: number) => void
	closed: (id: number) => void
	stop: () => void
}

/**
 * Send a close frame and drop the socket.
 * @param client - Tail client
 * @param reason - Why it is closing
 */
const pushClose = (client: Client, reason: TailCloseReason): void => {
	const message = tailCloseMessage(reason)
	try {
		client.send(JSON.stringify({ type: 'close', reason, message }))
	} catch {
		// The socket may already be gone.
	}
	try {
		client.close(TAIL_CLOSE_CODE[reason], message)
	} catch {
		// Close is idempotent.
	}
}

/**
 * One NATS subscription per distinct filter, fanned out to the browser sockets on that filter.
 * Presence and the 30 minute cap are enforced here. Protocol pings are not presence.
 * @param getNc - Current NATS connection, or null while reconnecting
 * @returns The hub
 */
export const createTailHub = (getNc: () => NatsConnection | null): TailHub => {
	const clients = new Map<number, Client>()
	const fans = new Map<string, Fan>()

	const dropFanIfEmpty = (filter: string): void => {
		const fan = fans.get(filter)
		if (!fan || fan.clients.size > 0) return
		fan.sub.unsubscribe()
		fans.delete(filter)
	}

	const remove = (client: Client, reason: TailCloseReason): void => {
		if (!clients.has(client.id)) return
		clients.delete(client.id)
		const fan = fans.get(client.filter)
		fan?.clients.delete(client)
		dropFanIfEmpty(client.filter)
		logger.info({
			message: 'tail closed',
			source,
			data: { ip: client.ip, filter: client.filter, reason },
		})
		pushClose(client, reason)
	}

	const deliver = (fan: Fan, subject: string, data: Uint8Array, now: number): void => {
		const text = new TextDecoder().decode(data)
		let payload: unknown = text
		if (data.byteLength > 65_536) {
			payload = { truncated: true, bytes: data.byteLength }
		} else {
			try {
				payload = JSON.parse(text) as unknown
			} catch {
				payload = text
			}
		}
		for (const client of fan.clients) {
			const decision = admitTailEvent(client.rate, now)
			client.rate = decision.rate
			if (!decision.forward) {
				if (now - client.lastDropNotice >= 1000) {
					client.lastDropNotice = now
					try {
						client.send(JSON.stringify({ type: 'sampled', dropped: decision.rate.dropped }))
					} catch {
						remove(client, 'client')
					}
				}
				continue
			}
			try {
				client.send(
					JSON.stringify({
						type: 'event',
						subject,
						at: new Date(now).toISOString(),
						payload,
						sampled: decision.sampled,
					})
				)
			} catch {
				remove(client, 'client')
			}
		}
	}

	const failFan = (fan: Fan): void => {
		for (const client of Array.from(fan.clients)) remove(client, 'denied')
	}

	const ensureFan = (filter: string, nc: NatsConnection): Fan => {
		const existing = fans.get(filter)
		if (existing) return existing
		const sub = nc.subscribe(filter, {
			callback: (err, msg) => {
				const fan = fans.get(filter)
				if (!fan) return
				if (err) {
					failFan(fan)
					return
				}
				deliver(fan, msg.subject, msg.data, Date.now())
			},
		})
		const fan: Fan = { filter, sub, clients: new Set() }
		fans.set(filter, fan)
		return fan
	}

	const timer = setInterval(() => {
		const now = Date.now()
		if (!getNc()) {
			for (const client of Array.from(clients.values())) remove(client, 'nats')
			return
		}
		for (const client of Array.from(clients.values())) {
			const reason = evaluateTail(client, now)
			if (reason) remove(client, reason)
		}
	}, 5_000)

	return {
		open: (input) => {
			const now = Date.now()
			if (!tailSlotFree(clients.size)) {
				const guest: Client = {
					...input,
					openedAt: now,
					lastBeatAt: now,
					rate: { windowStart: now, forwarded: 0, dropped: 0 },
					lastDropNotice: 0,
				}
				pushClose(guest, 'limit')
				logger.info({
					message: 'tail refused',
					source,
					data: { ip: input.ip, filter: input.filter, reason: 'limit' },
				})
				return
			}
			const nc = getNc()
			if (!nc) {
				const guest: Client = {
					...input,
					openedAt: now,
					lastBeatAt: now,
					rate: { windowStart: now, forwarded: 0, dropped: 0 },
					lastDropNotice: 0,
				}
				pushClose(guest, 'nats')
				return
			}
			let fan: Fan
			try {
				fan = ensureFan(input.filter, nc)
			} catch (error) {
				logger.error({ message: 'tail subscribe failed', source, error, data: { filter: input.filter } })
				const guest: Client = {
					...input,
					openedAt: now,
					lastBeatAt: now,
					rate: { windowStart: now, forwarded: 0, dropped: 0 },
					lastDropNotice: 0,
				}
				pushClose(guest, 'denied')
				return
			}
			const client: Client = {
				...input,
				openedAt: now,
				lastBeatAt: now,
				rate: { windowStart: now, forwarded: 0, dropped: 0 },
				lastDropNotice: 0,
			}
			clients.set(client.id, client)
			fan.clients.add(client)
			client.send(
				JSON.stringify({
					type: 'hello',
					filter: input.filter,
					idleMs: TAIL_IDLE_MS,
					capMs: TAIL_CAP_MS,
				})
			)
			logger.info({ message: 'tail opened', source, data: { ip: input.ip, filter: input.filter } })
		},
		beat: (id, now) => {
			const client = clients.get(id)
			if (!client) return
			client.lastBeatAt = now
		},
		closed: (id) => {
			const client = clients.get(id)
			if (!client) return
			clients.delete(id)
			const fan = fans.get(client.filter)
			fan?.clients.delete(client)
			dropFanIfEmpty(client.filter)
			logger.info({
				message: 'tail closed',
				source,
				data: { ip: client.ip, filter: client.filter, reason: 'client' },
			})
		},
		stop: () => {
			clearInterval(timer)
			for (const fan of fans.values()) fan.sub.unsubscribe()
			fans.clear()
			clients.clear()
		},
	}
}
