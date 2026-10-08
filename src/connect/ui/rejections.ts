import type { NatsConnection, Subscription } from '@nats-io/transport-node'
import type { Rejection, RejectionLog, ValidationErrorItem } from '#types'
import { errorMessage, isRecord, stringField } from './json.ts'

const MAX_REJECTIONS = 200

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
 * `errors[]` items that have the HTTPS API shape. Anything else is dropped.
 * @param value - `errors` from the feedback body
 * @returns Error items
 */
const feedbackErrors = (value: unknown): ValidationErrorItem[] => {
	if (!Array.isArray(value)) return []
	return value.flatMap((item) => {
		if (!isRecord(item)) return []
		const path = stringField(item, 'path')
		const message = stringField(item, 'message')
		const errorCode = stringField(item, 'errorCode')
		return path && message && errorCode ? [{ path, message, errorCode }] : []
	})
}

/**
 * Normalize one feedback payload. Institution falls back to the subject token.
 * @param text - Payload bytes decoded as UTF-8
 * @param subject - Subject the message arrived on
 * @param receivedAt - ISO time to use when the payload has no `created`
 * @returns A rejection row
 */
export const parseRejection = (text: string, subject: string, receivedAt: string): Rejection => {
	let parsed: unknown = null
	try {
		parsed = JSON.parse(text) as unknown
	} catch {
		parsed = null
	}
	const record = isRecord(parsed) ? parsed : null
	const fromSubject = subject.startsWith('feedback.') ? subject.slice('feedback.'.length) : null
	return {
		created: stringField(record, 'created') ?? receivedAt,
		institutionId: stringField(record, 'institutionId') ?? fromSubject,
		subject: stringField(record, 'subject') ?? subject,
		errors: feedbackErrors(record?.errors),
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
	const sorted = rows.toSorted((a, b) => b.created.localeCompare(a.created))
	const seen = new Set<string>()
	const merged: Rejection[] = []
	for (const row of sorted) {
		const key = `${row.created}|${row.subject ?? ''}|${JSON.stringify(row.errors)}`
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
