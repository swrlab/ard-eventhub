import type { ZodError } from 'zod'
import type { LivestreamOwner } from '../../utils/feed/known-livestreams.ts'
import type { OwnershipParty } from './ownership.ts'
import { parseConnectInboxEvent } from '../../schemas/events.ts'
import {
	eventClassToken,
	feedbackMqttTopic,
	institutionFromInboxSubject,
	pluginSubject,
	radioMqttTopic,
} from '../../utils/nats/subjects.ts'
import { enabledPluginTargets } from './eligibility.ts'
import { checkEventOwnership } from './ownership.ts'

/** Why a delivery is termed. Also the `cause` on `feedback/` and in the `validation rejected` log. */
type RejectCause = 'json' | 'schema' | 'ownership'

/** Larger payloads are logged and fed back as a prefix. NATS allows 1 MiB, radio events are a few KiB. */
const MAX_LOGGED_PAYLOAD_BYTES = 64 * 1024

/** Retained MQTT publish (`radio/` or `feedback/`). */
type MqttPublish = {
	topic: string
	body: unknown
}

/** NATS-native publish to a plugin subject. Not retained. */
type NatsPublish = {
	subject: string
	body: unknown
}

/** Accepted: retain on every `radio/` topic, fan out to every plugin subject, then ack. */
export type ValidationAccept = {
	action: 'ack'
	radio: MqttPublish[]
	plugins: NatsPublish[]
}

/** Rejected: retain the feedback (when the subject names an institution), then term. */
export type ValidationReject = {
	action: 'term'
	cause: RejectCause
	message: string
	feedback: MqttPublish | null
	/** The full inbox payload for the rejection log and the feedback body: decoded JSON, else the text. */
	payload: unknown
}

/** Work for one inbox message, before any publish or ack. */
export type ValidationPlan = ValidationAccept | ValidationReject

type FeedbackIssue = { path: string[]; message: string }

/**
 * Whether a value is a plain object.
 * @param value - Candidate
 * @returns True for non-null non-array objects
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Non-empty string field, read even when the schema later rejects the body.
 * @param value - Decoded JSON
 * @param key - Field name
 * @returns The string, or undefined
 */
const stringField = (value: unknown, key: string): string | undefined => {
	if (!isRecord(value)) return undefined
	const field = value[key]
	return typeof field === 'string' && field.length > 0 ? field : undefined
}

/**
 * Deprecated `services[]` fields validation ignores. Present means "still being sent".
 * @param value - Decoded JSON
 * @returns Field tokens for feedback
 */
const deprecatedFields = (value: unknown): string[] => {
	if (!isRecord(value) || !Array.isArray(value.services)) return []
	const found = new Set<string>()
	for (const service of value.services) {
		if (!isRecord(service)) continue
		if ('externalId' in service) found.add('services.externalId')
		if ('type' in service) found.add('services.type')
	}
	return [...found]
}

/**
 * Zod issues in the shape the operator UI already stores.
 * @param error - Parse error
 * @returns Path plus message
 */
const zodIssues = (error: ZodError): FeedbackIssue[] =>
	error.issues.map((issue) => ({
		path: issue.path.map((part) => String(part)),
		message: issue.message,
	}))

/**
 * Strict UTF-8 decode.
 * @param bytes - Payload
 * @returns Text, or null when the bytes are not UTF-8
 */
const decodeUtf8 = (bytes: Uint8Array): string | null => {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
	} catch {
		return null
	}
}

/**
 * JSON parse that reports failure instead of throwing.
 * @param text - Payload text
 * @returns The parsed value, or null when the text is not JSON
 */
const parseJson = (text: string): { value: unknown } | null => {
	try {
		return { value: JSON.parse(text) as unknown }
	} catch {
		return null
	}
}

/**
 * The payload as the rejection log shows it. Oversized payloads become a prefix with the byte count.
 * @param bytes - Raw payload
 * @param json - Parsed JSON, or null when the payload is not JSON
 * @returns JSON value, else the text (lossy when not UTF-8), else a truncated prefix
 */
const loggablePayload = (bytes: Uint8Array, json: { value: unknown } | null): unknown => {
	if (bytes.byteLength > MAX_LOGGED_PAYLOAD_BYTES) {
		return {
			truncated: true,
			bytes: bytes.byteLength,
			head: new TextDecoder().decode(bytes.subarray(0, MAX_LOGGED_PAYLOAD_BYTES)),
		}
	}
	return json ? json.value : new TextDecoder().decode(bytes)
}

/**
 * Drop undefined fields and empty lists so feedback only carries what is known.
 * @param fields - Candidate body
 * @returns Body without empty fields
 */
const withoutEmpty = (fields: Record<string, unknown>): Record<string, unknown> =>
	Object.fromEntries(
		Object.entries(fields).filter(([, field]) => field !== undefined && !(Array.isArray(field) && field.length === 0))
	)

/**
 * Term plan with a retained `feedback/{institutionId}` body the publisher and the rejections board can read.
 * @param params - Delivery context, cause, message, and whatever of the payload could be decoded
 * @returns A term plan
 */
const reject = (params: {
	at: string
	subject: string
	institutionId: string
	cause: RejectCause
	message: string
	payload: unknown
	value?: unknown
	issues?: FeedbackIssue[]
	disagreed?: OwnershipParty[]
	livestreamId?: string
}): ValidationReject => {
	const { at, subject, institutionId, cause, message, payload, value } = params
	const body = withoutEmpty({
		at,
		institutionId,
		subject,
		cause,
		message,
		issues: params.issues,
		disagreed: params.disagreed,
		playlistItemId: stringField(value, 'playlistItemId'),
		start: stringField(value, 'start'),
		deprecated: deprecatedFields(value),
		livestreamId: params.livestreamId,
		event: payload,
	})
	return { action: 'term', cause, message, feedback: { topic: feedbackMqttTopic(institutionId), body }, payload }
}

/**
 * Decide ack or term for one inbox delivery. Does not publish.
 * The loop only calls this once a feed is loaded, so an unknown livestream is a real ownership failure.
 * @param params - Subject, payload bytes, feed owners, and timestamp for feedback
 * @returns The plan
 */
export const planInboxMessage = (params: {
	subject: string
	bytes: Uint8Array
	owners: ReadonlyMap<string, LivestreamOwner>
	at: string
}): ValidationPlan => {
	const { subject, bytes, owners, at } = params
	const text = decodeUtf8(bytes)
	const json = text === null ? null : parseJson(text)
	const payload = loggablePayload(bytes, json)

	const institutionId = institutionFromInboxSubject(subject)
	if (!institutionId) {
		return {
			action: 'term',
			cause: 'ownership',
			message: 'inbox subject is not an institution URN',
			feedback: null,
			payload,
		}
	}
	const context = { at, subject, institutionId, payload }

	if (text === null) return reject({ ...context, cause: 'json', message: 'payload is not UTF-8' })
	if (!json) return reject({ ...context, cause: 'json', message: 'payload is not JSON', value: text })

	const { value } = json
	const parsed = parseConnectInboxEvent(value)
	if (!parsed.success) {
		const issues = zodIssues(parsed.error)
		return reject({
			...context,
			cause: 'schema',
			message: issues[0]?.message ?? 'event body failed schema validation',
			issues,
			value,
		})
	}

	const event = parsed.data
	const problem = checkEventOwnership({ subjectInstitutionId: institutionId, services: event.services, owners })
	if (problem) {
		return reject({
			...context,
			cause: 'ownership',
			message: problem.message,
			disagreed: problem.disagreed,
			livestreamId: problem.livestreamId,
			value,
		})
	}

	const eventClass = eventClassToken(event.event)
	const targets = enabledPluginTargets(event)
	const livestreamIds = [...new Set(event.services.map((service) => service.id))]
	return {
		action: 'ack',
		radio: livestreamIds.map((id) => ({ topic: radioMqttTopic(id, eventClass), body: event })),
		plugins: livestreamIds.flatMap((id) =>
			targets.map((target) => ({ subject: pluginSubject(target, id, eventClass), body: event }))
		),
	}
}
