import type { NatsConnection } from '@nats-io/transport-node'
import type { RetainedMessage, RetainedRead } from '#types'
import { jetstreamManager } from '@nats-io/jetstream'
import { errorMessage } from './json.ts'

const SUBJECT_CAP = 200
const READ_CONCURRENCY = 8

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
 * Last message per subject for a filter, read from JetStream. Empty when no stream holds the filter.
 * Direct gets are request/reply on `$JS.API`, not a streaming subscription.
 * @param nc - Open NATS connection
 * @param filter - Subject filter ending in `>` (`radio.>`, `feedback.>`)
 * @returns Messages, a truncation flag, and an error when the read failed outright
 */
export const readRetained = async (nc: NatsConnection, filter: string): Promise<RetainedRead> => {
	const prefix = filter.endsWith('>') ? filter.slice(0, -1) : filter
	try {
		const jsm = await jetstreamManager(nc)
		const streams: { name: string; subjects: string[] }[] = []
		for await (const info of jsm.streams.list()) {
			streams.push({ name: info.config.name, subjects: [...(info.config.subjects ?? [])] })
		}
		const subjects: string[] = []
		for (const stream of streams) {
			if (!streamCouldHold(stream.subjects, prefix)) continue
			const detail = await jsm.streams.info(stream.name, { subjects_filter: filter })
			for (const subject of Object.keys(detail.state.subjects ?? {})) subjects.push(subject)
		}
		const unique = [...new Set(subjects)]
		const truncated = unique.length > SUBJECT_CAP
		const chosen = unique.slice(0, SUBJECT_CAP)
		const bySubject = new Map<string, RetainedMessage>()
		const loaded = await pool(chosen, READ_CONCURRENCY, async (subject) => {
			for (const stream of streams) {
				if (!streamCouldHold(stream.subjects, prefix)) continue
				try {
					const msg = await jsm.streams.getMessage(stream.name, { last_by_subj: subject })
					if (!msg) continue
					return {
						subject: msg.subject,
						at: msg.timestamp,
						text: new TextDecoder().decode(msg.data),
					}
				} catch {
					continue
				}
			}
			return null
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
