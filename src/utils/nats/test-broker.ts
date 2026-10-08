import process from 'node:process'
import mqtt from 'mqtt'
import { LOCAL_NATS_PASSWORD, LOCAL_NATS_USERS } from '../../connect/dev-users.ts'
import { natsAccess } from './_client.ts'

export const NATS_SERVERS = process.env.NATS_URL?.trim() || 'nats://127.0.0.1:4222'
export const MQTT_URL = process.env.NATS_MQTT_URL?.trim() || 'mqtt://127.0.0.1:1883'
export const REQUIRE_NATS = process.env.NATS_REQUIRE === 'true'
const MQTT_V311 = 4

/**
 * Connect as local `svc-sidecar`, or return null when the broker is down / auth fails.
 * @returns Sidecar connection, or null
 */
export const tryConnectSidecar = async () => {
	try {
		return await natsAccess.connect({
			servers: NATS_SERVERS,
			user: LOCAL_NATS_USERS.svcSidecar,
			password: LOCAL_NATS_PASSWORD,
		})
	} catch {
		return null
	}
}

/**
 * Skip (or fail when `NATS_REQUIRE=true`) when NATS is not up with the local ACL config.
 * @param nc - Sidecar connection from `tryConnectSidecar`
 * @returns True when tests should return early
 */
export const skipUnlessNats = (nc: Awaited<ReturnType<typeof tryConnectSidecar>>): nc is null => {
	if (nc) {
		return false
	}
	const message = 'nats not listening on 4222 with local users — `just nats-up` or `just nats-up-docker`'
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
