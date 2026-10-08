import type { ConnectInboxEvent, EventhubV1RadioPostBody } from '../../schemas/events.ts'
import { ensureDefaultPlugins } from '../../utils/events/event-helpers.ts'

/**
 * Plugin claims the publisher sent. Missing `isDeactivated` means the plugin is on.
 * @param plugins - `plugins` array from a track event, or null
 * @returns Claims with a type
 */
const pluginClaims = (
	plugins: readonly { type?: string | undefined; isDeactivated?: unknown }[] | null | undefined
): EventhubV1RadioPostBody['plugins'] =>
	(plugins ?? []).flatMap((plugin) => {
		if (!plugin.type) return []
		return [{ type: plugin.type, isDeactivated: plugin.isDeactivated === true }]
	})

/**
 * Enabled plugin targets for one validated event.
 * Music `track.playing` auto-enables DTS and Radioplayer unless the publisher already set that type.
 * `track.next` does not auto-enable. A set plugin with `isDeactivated: true` stays off.
 * @param event - URN-only inbox event
 * @returns Target names, once each, in eligibility order
 */
export const enabledPluginTargets = (event: ConnectInboxEvent): string[] => {
	const isTrack =
		event.event === 'de.ard.eventhub.v1.radio.track.playing' || event.event === 'de.ard.eventhub.v1.radio.track.next'
	if (!isTrack) return []

	const draft = {
		name: event.event,
		plugins: pluginClaims(event.plugins),
	} as EventhubV1RadioPostBody
	ensureDefaultPlugins(draft, { type: event.type })

	const targets: string[] = []
	for (const plugin of draft.plugins) {
		if (!plugin.type || plugin.isDeactivated) continue
		if (!targets.includes(plugin.type)) targets.push(plugin.type)
	}
	return targets
}
