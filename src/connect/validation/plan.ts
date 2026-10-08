import type { RejectCause, ValidationErrorItem, ValidationPlan, ValidationReject } from '#types'
import { parseConnectInboxEvent } from '../../schemas/events.ts'
import {
	eventClassToken,
	feedbackMqttTopic,
	institutionFromInboxSubject,
	pluginSubject,
	radioMqttTopic,
} from '../../utils/nats/subjects.ts'
import { zodToOpenApiError } from '../../utils/validation/zod-to-openapi-error.ts'
import { enabledPluginTargets } from './eligibility.ts'
import { checkEventOwnership } from './ownership.ts'

/** Larger payloads are logged and fed back as a prefix. NATS allows 1 MiB, radio events are a few KiB. */
const MAX_LOGGED_PAYLOAD_BYTES = 64 * 1024

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
 * The payload as the validation log shows it. Oversized payloads become a prefix with the byte count.
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
 * Error for a body that never reached the schema.
 * @param message - What is wrong with the bytes
 * @returns One `.body` error
 */
const bodyError = (message: string): ValidationErrorItem[] => [
	{ path: '.body', message, errorCode: 'type.openapi.validation' },
]

/**
 * Term plan with a retained `feedback/{institutionId}` body the publisher and the rejections board can read.
 * @param params - Delivery context, cause, errors, and whatever of the payload could be decoded
 * @returns A term plan
 */
const reject = (params: {
	now: string
	subject: string
	institutionId: string
	cause: RejectCause
	errors: ValidationErrorItem[]
	payload: unknown
	value?: unknown
}): ValidationReject => {
	const { now, subject, institutionId, cause, errors, payload, value } = params
	const body = withoutEmpty({
		created: now,
		institutionId,
		subject,
		errors,
		playlistItemId: stringField(value, 'playlistItemId'),
		start: stringField(value, 'start'),
		deprecated: deprecatedFields(value),
		event: payload,
	})
	return { action: 'term', cause, errors, feedback: { topic: feedbackMqttTopic(institutionId), body }, payload }
}

/**
 * Decide ack or term for one inbox delivery. Does not publish.
 * The loop only calls this once a feed is loaded, so an unknown livestream is a real ownership failure.
 * @param params - Subject, payload bytes, and the delivery time (`created` on the event or the feedback)
 * @returns The plan
 */
export const planInboxMessage = (params: { subject: string; bytes: Uint8Array; now: string }): ValidationPlan => {
	const { subject, bytes, now } = params
	const text = decodeUtf8(bytes)
	const json = text === null ? null : parseJson(text)
	const payload = loggablePayload(bytes, json)

	const institutionId = institutionFromInboxSubject(subject)
	if (!institutionId) {
		return {
			action: 'term',
			cause: 'ownership',
			errors: [
				{
					path: '.params.institutionId',
					message: 'should match format "urn:ard:institution"',
					errorCode: 'format.openapi.validation',
				},
			],
			feedback: null,
			payload,
		}
	}
	const context = { now, subject, institutionId, payload }

	if (text === null) return reject({ ...context, cause: 'json', errors: bodyError('should be UTF-8') })
	if (!json) return reject({ ...context, cause: 'json', errors: bodyError('should be JSON'), value: text })

	const { value } = json
	const parsed = parseConnectInboxEvent(isRecord(value) ? { ...value, created: now } : value)
	if (!parsed.success) {
		const { errors } = zodToOpenApiError(parsed.error, 'body')
		return reject({ ...context, cause: 'schema', errors, value })
	}

	const event = parsed.data
	const ownershipErrors = checkEventOwnership({ subjectInstitutionId: institutionId, services: event.services })
	if (ownershipErrors.length > 0) return reject({ ...context, cause: 'ownership', errors: ownershipErrors, value })

	const eventClass = eventClassToken(event.event)
	const targets = enabledPluginTargets(event)
	const livestreamIds = [...new Set(event.services.map((service) => service.id))]
	return {
		action: 'ack',
		payload: bytes.byteLength > MAX_LOGGED_PAYLOAD_BYTES ? payload : event,
		radio: livestreamIds.map((id) => ({ topic: radioMqttTopic(id, eventClass), body: event })),
		plugins: livestreamIds.flatMap((id) =>
			targets.map((target) => ({ subject: pluginSubject(target, id, eventClass), body: event }))
		),
	}
}
