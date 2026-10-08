import type { NatsConnection, Subscription } from '@nats-io/transport-node'
import type { Rejection, RejectionLog } from '#types'
import { errorMessage, isRecord, stringField, stringList } from './json.ts'

const MAX_REJECTIONS = 200
const MAX_MESSAGE = 4_000

/**
 * In-memory ring of feedback seen while this process is up. Not a history store.
 * @returns A log capped at 200 rows
 */
export const createRejectionLog = (): RejectionLog => {
	const rows: Rejection[] = []
	let liveError: string | null = null
	return {
		push: (row) => {
			rows.push(row)
			if (rows.length > MAX_REJECTIONS) rows.shift()
		},
		list: () => rows.slice(),
		setLiveError: (message) => {
			liveError = message
		},
		liveError: () => liveError,
	}
}

/**
 * Full zod detail when the payload carries `issues`, otherwise the message string.
 * @param record - Parsed object, or null
 * @param text - Raw payload
 * @returns Text the board can show
 */
const zodMessage = (record: Record<string, unknown> | null, text: string): string => {
	if (record && Array.isArray(record.issues)) return JSON.stringify(record.issues).slice(0, MAX_MESSAGE)
	const message = stringField(record, 'message') ?? stringField(record, 'error')
	if (message) return message.slice(0, MAX_MESSAGE)
	return text.slice(0, MAX_MESSAGE)
}

/**
 * Normalize one feedback payload. Institution falls back to the subject token.
 * @param text - Payload bytes decoded as UTF-8
 * @param subject - Subject the message arrived on
 * @param at - ISO time to use when the payload has none
 * @returns A rejection row
 */
export const parseRejection = (text: string, subject: string, at: string): Rejection => {
	let parsed: unknown = null
	try {
		parsed = JSON.parse(text) as unknown
	} catch {
		parsed = null
	}
	const record = isRecord(parsed) ? parsed : null
	const fromSubject = subject.startsWith('feedback.') ? subject.slice('feedback.'.length) : null
	return {
		at: stringField(record, 'at') ?? stringField(record, 'start') ?? at,
		institutionId: stringField(record, 'institutionId') ?? fromSubject,
		subject: stringField(record, 'subject') ?? subject,
		message: zodMessage(record, text),
		cause: stringField(record, 'cause'),
		disagreed: stringList(record?.disagreed),
		playlistItemId: stringField(record, 'playlistItemId'),
		event: record?.event ?? null,
	}
}

/**
 * Newest first, duplicates removed, capped.
 * @param rows - Live ring plus retained feedback
 * @returns Rows for the board
 */
export const mergeRejections = (rows: Rejection[]): Rejection[] => {
	const sorted = rows.toSorted((a, b) => b.at.localeCompare(a.at))
	const seen = new Set<string>()
	const merged: Rejection[] = []
	for (const row of sorted) {
		const key = `${row.at}|${row.subject ?? ''}|${row.message}`
		if (seen.has(key)) continue
		seen.add(key)
		merged.push(row)
		if (merged.length >= MAX_REJECTIONS) break
	}
	return merged
}

/**
 * Keep rejections for one institution. A null filter returns every row.
 * @param rows - Merged rejections
 * @param institution - Institution URN, or null
 * @returns Filtered rows
 */
export const filterRejections = (rows: Rejection[], institution: string | null): Rejection[] =>
	institution ? rows.filter((row) => row.institutionId === institution) : rows

/**
 * Subscribe to `feedback.>` for the life of this connection. One process-level sub, not one per browser.
 * @param nc - Open NATS connection
 * @param log - Ring buffer
 * @returns Unsubscribe
 */
export const attachFeedback = (nc: NatsConnection, log: RejectionLog): (() => void) => {
	let sub: Subscription
	try {
		sub = nc.subscribe('feedback.>')
	} catch (error) {
		log.setLiveError(errorMessage(error))
		return () => undefined
	}
	const task = (async () => {
		for await (const msg of sub) {
			const text = new TextDecoder().decode(msg.data)
			log.push(parseRejection(text, msg.subject, new Date().toISOString()))
		}
	})()
	task.catch((error: unknown) => {
		log.setLiveError(errorMessage(error))
	})
	return () => {
		sub.unsubscribe()
	}
}
