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
import { checkServiceOwnership } from './ownership.ts'

/** What the consumer does with one inbox delivery. */
export type SidecarAction = 'ack' | 'term' | 'nak'

/** MQTT publish. Radio and feedback are always retained. */
export type MqttPublish = {
	topic: string
	body: unknown
	retain: true
}

/** NATS-native publish. Plugin subjects are not retained. */
export type NatsPublish = {
	subject: string
	body: unknown
}

/** Work for one inbox message, before any publish or ack. */
export type SidecarPlan = {
	action: SidecarAction
	/** Short term reason, or null when the message will be acked or nak'd. */
	reason: string | null
	mqtt: MqttPublish[]
	nats: NatsPublish[]
}

/**
 * Whether a value is a plain object.
 * @param value - Candidate
 * @returns True for non-null non-array objects
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Optional correlation fields, read even when the schema later rejects the body.
 * @param value - Decoded JSON
 * @returns playlist id, start, and event name when they are strings
 */
const identityOf = (value: unknown): { playlistItemId: string | null; start: string | null; event: string | null } => {
	if (!isRecord(value)) return { playlistItemId: null, start: null, event: null }
	const read = (key: string): string | null => {
		const field = value[key]
		return typeof field === 'string' && field.length > 0 ? field : null
	}
	return { playlistItemId: read('playlistItemId'), start: read('start'), event: read('event') }
}

/**
 * Deprecated `services[]` fields the sidecar ignores. Present means "still being sent".
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
const zodIssues = (error: ZodError): { path: string[]; message: string }[] =>
	error.issues.map((issue) => ({
		path: issue.path.map((part) => String(part)),
		message: issue.message,
	}))

/**
 * Feedback body for `feedback/{institutionId}`.
 * @param params - Institution, inbox subject, cause, and optional identity
 * @returns JSON the publisher and the rejections board can read
 */
const feedbackBody = (params: {
	at: string
	institutionId: string
	subject: string
	cause: 'schema' | 'ownership' | 'json'
	message: string
	issues?: { path: string[]; message: string }[]
	disagreed?: OwnershipParty[]
	playlistItemId?: string | null
	start?: string | null
	event?: string | null
	deprecated?: string[]
	livestreamId?: string
}): Record<string, unknown> => {
	const body: Record<string, unknown> = {
		at: params.at,
		institutionId: params.institutionId,
		subject: params.subject,
		cause: params.cause,
		message: params.message,
	}
	if (params.issues && params.issues.length > 0) body.issues = params.issues
	if (params.disagreed && params.disagreed.length > 0) body.disagreed = params.disagreed
	if (params.playlistItemId) body.playlistItemId = params.playlistItemId
	if (params.start) body.start = params.start
	if (params.event) body.event = params.event
	if (params.deprecated && params.deprecated.length > 0) body.deprecated = params.deprecated
	if (params.livestreamId) body.livestreamId = params.livestreamId
	return body
}

/**
 * Term plan that notifies the institution, or a bare term when the subject has no institution.
 * @param params - Subject, time, and feedback fields
 * @returns A term plan
 */
const reject = (params: {
	at: string
	subject: string
	reason: 'schema' | 'ownership' | 'json'
	message: string
	issues?: { path: string[]; message: string }[]
	disagreed?: OwnershipParty[]
	value?: unknown
	livestreamId?: string
}): SidecarPlan => {
	const institutionId = institutionFromInboxSubject(params.subject)
	if (!institutionId) {
		return { action: 'term', reason: params.reason, mqtt: [], nats: [] }
	}
	const identity = identityOf(params.value)
	return {
		action: 'term',
		reason: params.reason,
		mqtt: [
			{
				topic: feedbackMqttTopic(institutionId),
				retain: true,
				body: feedbackBody({
					at: params.at,
					institutionId,
					subject: params.subject,
					cause: params.reason,
					message: params.message,
					...(params.issues ? { issues: params.issues } : {}),
					...(params.disagreed ? { disagreed: params.disagreed } : {}),
					...(identity.playlistItemId ? { playlistItemId: identity.playlistItemId } : {}),
					...(identity.start ? { start: identity.start } : {}),
					...(identity.event ? { event: identity.event } : {}),
					...(deprecatedFields(params.value).length > 0 ? { deprecated: deprecatedFields(params.value) } : {}),
					...(params.livestreamId ? { livestreamId: params.livestreamId } : {}),
				}),
			},
		],
		nats: [],
	}
}

/**
 * Decide ack, term, or nak for one inbox delivery. Does not publish.
 * Schema failures are termed. A missing feed is nak'd so a crash-style redelivery can pass later.
 * @param params - Subject, payload bytes, feed owners, and timestamp for feedback
 * @returns The plan
 */
export const planInboxMessage = (params: {
	subject: string
	bytes: Uint8Array
	/** Null while no feed is loaded. A miss in the map is an unknown livestream. */
	owners: Map<string, LivestreamOwner> | null
	at: string
}): SidecarPlan => {
	const { subject, bytes, owners, at } = params
	let text: string
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
	} catch {
		return reject({ at, subject, reason: 'json', message: 'payload is not UTF-8' })
	}

	let value: unknown
	try {
		value = JSON.parse(text) as unknown
	} catch {
		return reject({ at, subject, reason: 'json', message: 'payload is not JSON', value: text })
	}

	const parsed = parseConnectInboxEvent(value)
	if (!parsed.success) {
		const issues = zodIssues(parsed.error)
		return reject({
			at,
			subject,
			reason: 'schema',
			message: issues[0]?.message ?? 'event body failed schema validation',
			issues,
			value,
		})
	}

	if (!owners) {
		return { action: 'nak', reason: 'feed', mqtt: [], nats: [] }
	}

	const event = parsed.data
	const problems = event.services.map((service) =>
		checkServiceOwnership({
			subjectInstitutionId: institutionFromInboxSubject(subject) ?? '',
			service,
			owner: owners.get(service.id) ?? null,
		})
	)
	const failed = problems.filter((problem) => problem !== null)
	if (!institutionFromInboxSubject(subject) || failed.length > 0) {
		const disagreed = new Set<OwnershipParty>()
		for (const problem of failed) {
			for (const party of problem.disagreed) disagreed.add(party)
		}
		const parties = (['subject', 'payload', 'feed'] as const).filter((party) => disagreed.has(party))
		const livestreamId = failed[0]?.livestreamId
		return reject({
			at,
			subject,
			reason: 'ownership',
			message: failed.map((problem) => problem.message).join('; ') || 'inbox subject is not an institution URN',
			disagreed: parties,
			value,
			...(livestreamId ? { livestreamId } : {}),
		})
	}

	const eventClass = eventClassToken(event.event)
	const targets = enabledPluginTargets(event)
	const mqtt: MqttPublish[] = []
	const nats: NatsPublish[] = []
	const seenLivestreams = new Set<string>()
	for (const service of event.services) {
		if (seenLivestreams.has(service.id)) continue
		seenLivestreams.add(service.id)
		mqtt.push({ topic: radioMqttTopic(service.id, eventClass), retain: true, body: event })
		for (const target of targets) {
			nats.push({ subject: pluginSubject(target, service.id, eventClass), body: event })
		}
	}
	return { action: 'ack', reason: null, mqtt, nats }
}
