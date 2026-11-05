import type { AuthUser } from '#types'
import type { EventhubService, EventhubV1RadioPostBody } from '../../schemas/events.ts'
import { DateTime } from '@frytg/dates'

const DEFAULT_ZONE = 'Europe/Berlin'

/** Max age of `start` before the event is rejected. */
export const MAX_OFFSET_IN_MINUTES = 15

/**
 * Whether the event start time is older than the allowed offset.
 * @param start - Parsed event start time
 * @param now - Reference "now" (injectable for tests)
 * @returns True when the start is too far in the past
 */
export const isEventStartExpired = (start: DateTime, now: DateTime = DateTime.now()): boolean =>
	start.plus({ minutes: MAX_OFFSET_IN_MINUTES }) < now

/**
 * Parse the event start timestamp in the default zone.
 * @param start - ISO start string from the request body
 * @returns Parsed DateTime
 */
export const parseEventStart = (start: unknown): DateTime =>
	DateTime.fromISO(String(start), {
		zone: DEFAULT_ZONE,
	})

/**
 * Build the enriched Pub/Sub event message from the payload and auth user.
 * @param params - Event name, user, body, and parsed start
 * @returns Enriched event message (services still need processing)
 */
export const buildEventMessage = (params: {
	eventName: string
	user: AuthUser
	body: Record<string, unknown>
	start: DateTime
}): EventhubV1RadioPostBody => {
	const { eventName, user, body, start } = params

	return {
		name: eventName,
		creator: user.email as string,
		created: DateTime.now().toLocal().toISO(),
		plugins: [] as EventhubV1RadioPostBody['plugins'],

		// use entire body to include potentially new fields
		...structuredClone(body),

		// reformat start time
		start: start.toLocal().toISO() as string,
	} as unknown as EventhubV1RadioPostBody
}

/**
 * Build the Connect inbox payload from the enriched Pub/Sub message.
 * Drops the Pub/Sub-only `name` field and sets the `event` discriminator Connect's inbox schema requires,
 * so the HTTPS dual-write to `inbox/{institutionId}` matches what `parseConnectInboxEvent` accepts.
 * @param message - Enriched event message (output of {@link buildEventMessage})
 * @param eventName - Event name the HTTPS request was posted under
 * @returns Payload shaped for Connect's inbox schema (still unvalidated)
 */
export const buildInboxPayload = (message: EventhubV1RadioPostBody, eventName: string): Record<string, unknown> => {
	const payload: Record<string, unknown> = { ...(message as unknown as Record<string, unknown>), event: eventName }
	delete payload.name
	return payload
}

/**
 * Enable DTS / Radioplayer plugins by opt-out for music `track.playing` events only.
 * Does not auto-enable for `track.next`.
 * @param message - Event message (plugins array mutated)
 * @param body - Original event body
 */
export const ensureDefaultPlugins = (message: EventhubV1RadioPostBody, body: Record<string, unknown>): void => {
	const isDtsPluginSet = message.plugins?.find((plugin) => plugin.type === 'dts')
	const isRadioplayerPluginSet = message.plugins?.find((plugin) => plugin.type === 'radioplayer')
	const isMusic = body.type === 'music'
	const isNowPlayingEvent = message.name === 'de.ard.eventhub.v1.radio.track.playing'

	if (!isDtsPluginSet && isMusic && isNowPlayingEvent) {
		message.plugins.push({
			type: 'dts',
			isDeactivated: false,
			note: 'automatically enabled by opt-out',
		})
	}

	if (!isRadioplayerPluginSet && isMusic && isNowPlayingEvent) {
		message.plugins.push({
			type: 'radioplayer',
			isDeactivated: false,
			note: 'automatically enabled by opt-out',
		})
	}
}

/**
 * Compute publish/blocked/failed counts for the response payload.
 * @param services - Final service list after publish attempts
 * @returns Status counters
 */
export const summarizeEventStatuses = (services: EventhubService[]) => ({
	published: services.filter((service) => service.topic?.messageId).length,
	blocked: services.filter((service) => service.blocked).length,
	failed: services.filter((service) => !(service.topic?.messageId || service.blocked)).length,
})
