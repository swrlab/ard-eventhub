import type { NatsConnection } from '@nats-io/transport-node'
import type { RetainedMessage, RetainedRead } from '#types'
import { jetstreamManager } from '@nats-io/jetstream'
import { errorMessage } from './json.ts'

const SUBJECT_CAP = 200
const READ_CONCURRENCY = 8

/**
 * JetStream prefix for one MQTT retained message.
 * The public subject `radio.{livestream}.track.playing` is stored as `$MQTT.rmsgs.radio.{livestream}.track.playing`.
 */
const MQTT_RETAINED_PREFIX = '$MQTT.rmsgs.'

/**
 * Whether a stream subject list can hold messages for a filter prefix (`radio.` / `feedback.`).
 * @param patterns - Stream subject patterns
 * @param prefix - Filter prefix, including the trailing dot when the filter was `radio.>`
 * @returns True when the stream is worth a subject scan
 */
export const streamCouldHold = (patterns: readonly string[], prefix: string): boolean =>
	patterns.some((pattern) => {
		if (pattern === '>') return true
		const normalized = pattern.endsWith('.>') ? pattern.slice(0, -2) : pattern.replace(/>$/, '')
		return prefix.startsWith(normalized) || normalized.startsWith(prefix) || pattern.includes('*')
	})

/**
 * Subject filter to ask one stream for, given the public filter (`radio.>`, `feedback.>`).
 * A stream that captures the public subject is asked for that filter.
 * The MQTT retain stream is asked for `$MQTT.rmsgs.` plus the same filter.
 * @param patterns - Stream subject patterns
 * @param filter - Public subject filter
 * @returns The filter for this stream, or null when it cannot hold the messages
 */
export const retainedFilterForStream = (patterns: readonly string[], filter: string): string | null => {
	const prefix = filter.endsWith('>') ? filter.slice(0, -1) : filter
	if (streamCouldHold(patterns, prefix)) return filter
	if (streamCouldHold(patterns, MQTT_RETAINED_PREFIX)) return `${MQTT_RETAINED_PREFIX}${filter}`
	return null
}

/**
 * Public subject for a stored retained message.
 * @param subject - Subject JetStream returned
 * @returns Subject without the MQTT retain prefix
 */
export const publicRetainedSubject = (subject: string): string =>
	subject.startsWith(MQTT_RETAINED_PREFIX) ? subject.slice(MQTT_RETAINED_PREFIX.length) : subject

/**
 * Run async work over a list with a fixed number of workers.
 * @param items - Work items
 * @param limit - Maximum in flight
 * @param fn - Worker
 * @returns Results in input order
 */
const pool = async <T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
	const results = Array.from({ length: items.length }) as R[]
	let cursor = 0
	const worker = async (): Promise<void> => {
		for (;;) {
			const current = cursor
			cursor += 1
			if (current >= items.length) return
			const item = items[current]
			if (item === undefined) return
			results[current] = await fn(item)
		}
	}
	const workers = Math.min(limit, items.length)
	if (workers === 0) return results
	await Promise.all(Array.from({ length: workers }, () => worker()))
	return results
}

/**
 * Last message per public subject for a filter.
 * Radio and feedback retains are MQTT publishes, so they live in `$MQTT_rmsgs` under `$MQTT.rmsgs.`, not on `radio.>`.
 * Direct gets are request/reply on `$JS.API`, not a streaming subscription.
 * @param nc - Open NATS connection
 * @param filter - Public subject filter ending in `>` (`radio.>`, `feedback.>`)
 * @returns Messages, a truncation flag, and an error when the read failed outright
 */
export const readRetained = async (nc: NatsConnection, filter: string): Promise<RetainedRead> => {
	try {
		const jsm = await jetstreamManager(nc)
		const streams: { name: string; filter: string }[] = []
		for await (const info of jsm.streams.list()) {
			const streamFilter = retainedFilterForStream([...(info.config.subjects ?? [])], filter)
			if (!streamFilter) continue
			streams.push({ name: info.config.name, filter: streamFilter })
		}
		const located: { stream: string; stored: string }[] = []
		for (const stream of streams) {
			const detail = await jsm.streams.info(stream.name, { subjects_filter: stream.filter })
			for (const stored of Object.keys(detail.state.subjects ?? {})) located.push({ stream: stream.name, stored })
		}
		const unique = [...new Map(located.map((item) => [`${item.stream}\0${item.stored}`, item])).values()]
		const truncated = unique.length > SUBJECT_CAP
		const chosen = unique.slice(0, SUBJECT_CAP)
		const bySubject = new Map<string, RetainedMessage>()
		const loaded = await pool(chosen, READ_CONCURRENCY, async ({ stream, stored }) => {
			try {
				const msg = await jsm.streams.getMessage(stream, { last_by_subj: stored })
				if (!msg) return null
				return {
					subject: publicRetainedSubject(msg.subject),
					at: msg.timestamp,
					text: new TextDecoder().decode(msg.data),
				}
			} catch {
				return null
			}
		})
		for (const message of loaded) {
			if (!message) continue
			const previous = bySubject.get(message.subject)
			if (!previous || message.at > previous.at) bySubject.set(message.subject, message)
		}
		return { messages: [...bySubject.values()], truncated, error: null }
	} catch (error) {
		return { messages: [], truncated: false, error: errorMessage(error) }
	}
}
