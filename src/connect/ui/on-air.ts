import type { OnAirControl, OnAirData, OnAirStation, OnAirTrack } from './types.ts'
import { booleanField, isRecord, stringField } from './json.ts'

const EVENT_CLASSES = ['track.playing', 'track.next', 'control', 'data'] as const

export type RadioEventClass = (typeof EVENT_CLASSES)[number]

export type RadioObservation = {
	subject: string
	at: string
	payload: unknown
}

/**
 * Split `radio.{livestreamId}.{eventClass}` into its two parts.
 * Longer suffixes are tried first so `track.playing` is not read as a livestream id.
 * @param subject - NATS subject
 * @returns Livestream id and event class, or null when the subject is not retained radio state
 */
export const parseRadioSubject = (subject: string): { livestreamId: string; eventClass: RadioEventClass } | null => {
	if (!subject.startsWith('radio.')) return null
	const rest = subject.slice('radio.'.length)
	for (const eventClass of EVENT_CLASSES) {
		const suffix = `.${eventClass}`
		if (!rest.endsWith(suffix)) continue
		const livestreamId = rest.slice(0, -suffix.length)
		if (!livestreamId) return null
		return { livestreamId, eventClass }
	}
	return null
}

/**
 * First service object on a track or control payload.
 * @param payload - Parsed JSON
 * @returns The service record, or null
 */
const firstService = (payload: Record<string, unknown>): Record<string, unknown> | null => {
	const services = payload.services
	if (!Array.isArray(services) || !isRecord(services[0])) return null
	return services[0]
}

/**
 * Track fields the on-air board shows.
 * @param payload - Parsed JSON, or null
 * @param at - Observation time
 * @returns Track summary
 */
const readTrack = (payload: unknown, at: string): OnAirTrack => {
	const record = isRecord(payload) ? payload : null
	const service = record ? firstService(record) : null
	return {
		title: stringField(record, 'title'),
		artist: stringField(record, 'artist'),
		publisherId: stringField(service, 'publisherId'),
		at,
	}
}

/**
 * Latest control flag on the retained `control` subject.
 * One subject keeps one message, so this is the last flag, not every flag still inside `validUntil`.
 * @param payload - Parsed JSON, or null
 * @param at - Observation time
 * @returns Control summary
 */
const readControl = (payload: unknown, at: string): OnAirControl => {
	const record = isRecord(payload) ? payload : null
	return {
		name: stringField(record, 'name'),
		state: booleanField(record, 'state'),
		validUntil: stringField(record, 'validUntil'),
		at,
	}
}

/**
 * First radiotext / dynamic-label value on a `radio.data` payload.
 * @param payload - Parsed JSON, or null
 * @param at - Observation time
 * @returns Data summary
 */
const readData = (payload: unknown, at: string): OnAirData => {
	const record = isRecord(payload) ? payload : null
	const items = record && Array.isArray(record.data) ? record.data : []
	for (const item of items) {
		if (!isRecord(item)) continue
		const text = stringField(item, 'value')
		if (text) return { text, at }
	}
	return { text: stringField(record, 'text'), at }
}

/**
 * Institution claim from the first service that carries one.
 * @param payload - Parsed JSON
 * @returns Institution URN, or null
 */
const institutionOf = (payload: unknown): string | null => {
	if (!isRecord(payload)) return null
	return stringField(firstService(payload), 'institutionId')
}

const emptyStation = (livestreamId: string): OnAirStation => ({
	livestreamId,
	institutionId: null,
	lastEventAt: null,
	playing: null,
	next: null,
	control: null,
	data: null,
})

/**
 * Whether `at` is later than the current stamp.
 * @param at - Candidate ISO time
 * @param current - Stamp already kept, or null
 * @returns True when `at` should replace `current`
 */
const newer = (at: string, current: string | null): boolean => current === null || at > current

/**
 * Group retained radio messages into one row per livestream.
 * Quietest station first: oldest `lastEventAt`, missing times before any timestamp.
 * @param observations - Last message per subject
 * @returns Stations
 */
export const foldOnAir = (observations: RadioObservation[]): OnAirStation[] => {
	const byId = new Map<string, OnAirStation>()
	for (const observation of observations) {
		const parsed = parseRadioSubject(observation.subject)
		if (!parsed) continue
		const station = byId.get(parsed.livestreamId) ?? emptyStation(parsed.livestreamId)
		const institutionId = institutionOf(observation.payload)
		if (institutionId) station.institutionId = institutionId
		if (newer(observation.at, station.lastEventAt)) station.lastEventAt = observation.at
		switch (parsed.eventClass) {
			case 'track.playing':
				if (!station.playing || newer(observation.at, station.playing.at)) {
					station.playing = readTrack(observation.payload, observation.at)
				}
				break
			case 'track.next':
				if (!station.next || newer(observation.at, station.next.at)) {
					station.next = readTrack(observation.payload, observation.at)
				}
				break
			case 'control':
				if (!station.control || newer(observation.at, station.control.at)) {
					station.control = readControl(observation.payload, observation.at)
				}
				break
			case 'data':
				if (!station.data || newer(observation.at, station.data.at)) {
					station.data = readData(observation.payload, observation.at)
				}
				break
		}
		byId.set(parsed.livestreamId, station)
	}
	return [...byId.values()].toSorted((a, b) => {
		if (a.lastEventAt === null && b.lastEventAt === null) return a.livestreamId.localeCompare(b.livestreamId)
		if (a.lastEventAt === null) return -1
		if (b.lastEventAt === null) return 1
		return a.lastEventAt.localeCompare(b.lastEventAt)
	})
}
