import process from 'node:process'
import mqtt from 'mqtt'
import { mqttUrlForNats, parseUserinfoUrl } from '../url-auth.ts'
import { natsAccess } from './_client.ts'

const rawNatsUrl = process.env.NATS_URL?.trim() || 'nats://127.0.0.1:4222'
const natsEndpoint = parseUserinfoUrl(rawNatsUrl)

/** Host URL with userinfo removed, so ACL tests can pass a different username. */
export const NATS_SERVERS = natsEndpoint.url

/** Password from `NATS_PASSWORD`. Local users in nats-users.conf share this secret. */
export const BROKER_PASSWORD = process.env.NATS_PASSWORD?.trim() || ''

const NATS_USER = process.env.NATS_USER?.trim() || ''

export const MQTT_URL = process.env.NATS_MQTT_URL?.trim() || mqttUrlForNats(NATS_SERVERS)
export const REQUIRE_NATS = process.env.NATS_REQUIRE === 'true'
const MQTT_V311 = 4

/**
 * Connect with `NATS_USER` and `NATS_PASSWORD`, or return null when the broker is down / auth fails.
 * @returns Service connection, or null
 */
export const tryConnectService = async () => {
	try {
		return await natsAccess.connect({
			servers: NATS_SERVERS,
			...(NATS_USER ? { user: NATS_USER } : {}),
			...(BROKER_PASSWORD ? { password: BROKER_PASSWORD } : {}),
		})
	} catch {
		return null
	}
}

/**
 * Skip (or fail when `NATS_REQUIRE=true`) when NATS is not up with the local ACL config.
 * @param nc - Service connection from `tryConnectService`
 * @returns True when tests should return early
 */
export const skipUnlessNats = (nc: Awaited<ReturnType<typeof tryConnectService>>): nc is null => {
	if (nc) {
		return false
	}
	const message = 'nats not listening on 4222 with NATS_USER / NATS_PASSWORD — `just nats-up` or `just nats-up-docker`'
	if (REQUIRE_NATS) {
		throw new Error(message)
	}
	console.warn(`skip: ${message}`)
	return true
}

/**
 * MQTT v3.1.1 client against the local NATS MQTT gateway.
 * @param username - Config user
 * @param password - Plaintext password
 * @returns Connected mqtt.js client
 */
export const connectMqttUser = (username: string, password: string) =>
	mqtt.connectAsync(MQTT_URL, {
		protocolVersion: MQTT_V311,
		clientId: `eventhub-nats-auth-${username}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
		username,
		password,
		connectTimeout: 3_000,
	})
