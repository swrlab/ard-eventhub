/** A zone or stage name that can sit in `eventhub-connect-<zone>-<stage>`. */
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Page address the switcher keeps: domain, port, path, query, and hash. */
type PageLocation = Pick<Location, 'protocol' | 'hostname' | 'port' | 'pathname' | 'search' | 'hash'>

/**
 * Operator UI of another zone or stage. The host's first label is `eventhub-connect-<zone>-<stage>`,
 * so the page swaps that label and stays on the same domain and path. Localhost has nothing to swap.
 * @param zone - `ZONE` of the process serving this page
 * @param stage - `STAGE` of the process serving this page
 * @param nextZone - Zone the operator picked
 * @param nextStage - Stage the operator picked
 * @param location - Current page location
 * @returns Absolute URL, or null when this host is not the current name
 */
export const envSwitchUrl = (
	zone: string,
	stage: string,
	nextZone: string,
	nextStage: string,
	location: PageLocation
): string | null => {
	if (location.protocol !== 'http:' && location.protocol !== 'https:') return null
	if (!NAME.test(zone) || !NAME.test(stage) || !NAME.test(nextZone) || !NAME.test(nextStage)) return null
	if (nextZone === zone && nextStage === stage) return null
	const dot = location.hostname.indexOf('.')
	if (dot <= 0) return null
	const label = location.hostname.slice(0, dot)
	if (label !== `eventhub-connect-${zone}-${stage}`) return null
	const port = location.port ? `:${location.port}` : ''
	return `${location.protocol}//eventhub-connect-${nextZone}-${nextStage}${location.hostname.slice(dot)}${port}${location.pathname}${location.search}${location.hash}`
}
