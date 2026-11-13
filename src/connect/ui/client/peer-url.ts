/**
 * Operator UI URL of a cluster peer. NATS server names are the first label of each machine's stage hostname
 * (`eventhub-connect-mnz-dev`), so swapping that label in the current host keeps the domain the operator is on.
 * Only works when the page itself is served under its own server name; locally there is nothing to swap.
 * @param peer - Server name of the peer
 * @param self - Server names this process sampled; the current host must start with one of them
 * @param location - Current page location
 * @returns Absolute URL of the same page on the peer, or null when the host does not follow the naming
 */
export const peerUrl = (
	peer: string,
	self: string[],
	location: Pick<Location, 'protocol' | 'hostname' | 'port' | 'pathname'>
): string | null => {
	const dot = location.hostname.indexOf('.')
	if (dot <= 0) return null
	const label = location.hostname.slice(0, dot)
	if (!self.includes(label) || label === peer) return null
	const port = location.port ? `:${location.port}` : ''
	return `${location.protocol}//${peer}${location.hostname.slice(dot)}${port}${location.pathname}`
}
