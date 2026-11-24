import type { IClientOptions } from 'mqtt'
import { parseUserinfoUrl } from '../url-auth.ts'

const MQTT_DEFAULT_PORT = 1883
const MQTTS_DEFAULT_PORT = 8883

/** One gateway in the ingest failover list. */
export type MqttBrokerServer = {
	protocol: 'mqtt' | 'mqtts'
	host: string
	port: number
}

/**
 * Brokers named by `MQTT_BROKER_URL`.
 * One shared account. mqtt.js keeps a single connection and walks `servers` when that hop drops.
 */
export type MqttBrokerList = {
	servers: MqttBrokerServer[]
	user: string
	password: string
	/** Hosts dropped because their userinfo disagreed with the shared account. Safe to log. */
	rejectedHosts: string[]
	/** Entries that were not an `mqtt://` or `mqtts://` URL. */
	invalidCount: number
}

/**
 * Address safe to log. No userinfo.
 * @param server - One parsed gateway
 * @returns `mqtt://host:port` or `mqtts://host:port`
 */
export const mqttBrokerLabel = (server: MqttBrokerServer): string =>
	`${server.protocol}://${server.host}:${server.port}`

/**
 * True when `raw` names at least one gateway. Blank means ingest stays on Pub/Sub.
 * @param raw - `MQTT_BROKER_URL`, one URL or a comma-separated list
 * @returns Whether the CN gateway client should start
 */
export const isMqttBrokerConfigured = (raw: string): boolean => parseMqttBrokerList(raw).servers.length > 0

/**
 * mqtt.js fields for a parsed list. Credentials stay off `servers`.
 * @param list - Result of `parseMqttBrokerList`
 * @returns `servers`, plus username and password when the list has them
 */
export const mqttBrokerClientOptions = (
	list: MqttBrokerList
): Pick<IClientOptions, 'servers' | 'username' | 'password'> => ({
	servers: list.servers,
	...(list.user ? { username: list.user } : {}),
	...(list.password ? { password: list.password } : {}),
})

/**
 * Split `MQTT_BROKER_URL` into a failover list.
 * Commas separate brokers. A comma inside the password must be `%2C`.
 * The first userinfo wins. A later URL may omit it, or repeat the same pair.
 * A different user or password drops that host. One URL stays a one-entry list.
 * @param raw - Env value. Empty when unset
 * @returns Servers in order, the shared account, and what was skipped
 */
export const parseMqttBrokerList = (raw: string): MqttBrokerList => {
	const servers: MqttBrokerServer[] = []
	const rejectedHosts: string[] = []
	const seen = new Set<string>()
	let user = ''
	let password = ''
	let credentialsSet = false
	let invalidCount = 0

	for (const segment of raw.split(',')) {
		const trimmed = segment.trim()
		if (!trimmed) continue

		const parsed = parseUserinfoUrl(trimmed)
		let url: URL
		try {
			url = new URL(parsed.url)
		} catch {
			invalidCount += 1
			continue
		}

		const protocol = url.protocol === 'mqtt:' ? 'mqtt' : url.protocol === 'mqtts:' ? 'mqtts' : null
		if (!protocol || !url.hostname) {
			invalidCount += 1
			continue
		}

		const port = url.port ? Number(url.port) : protocol === 'mqtts' ? MQTTS_DEFAULT_PORT : MQTT_DEFAULT_PORT
		if (!Number.isInteger(port) || port <= 0 || port > 65535) {
			invalidCount += 1
			continue
		}

		const server: MqttBrokerServer = { protocol, host: url.hostname, port }
		const hasCredentials = parsed.user.length > 0 || parsed.password.length > 0
		if (hasCredentials) {
			if (!credentialsSet) {
				user = parsed.user
				password = parsed.password
				credentialsSet = true
			} else if (parsed.user !== user || parsed.password !== password) {
				rejectedHosts.push(mqttBrokerLabel(server))
				continue
			}
		}

		const label = mqttBrokerLabel(server)
		if (seen.has(label)) continue
		seen.add(label)
		servers.push(server)
	}

	return { servers, user, password, rejectedHosts, invalidCount }
}
