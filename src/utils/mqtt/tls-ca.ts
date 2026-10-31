import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'

const PEM_BEGIN = '-----BEGIN'

/**
 * Resolve an extra TLS CA for mqtts:// against a private hop.
 * `MQTT_TLS_CA` is PEM text, or a path to a PEM file. Empty means Node's default trust store.
 * @param value - Env value (`MQTT_TLS_CA`)
 * @returns CA bytes for mqtt.js `ca`, or undefined when unset
 */
export const resolveMqttTlsCa = (value: string): Buffer | undefined => {
	if (!value.trim()) return undefined
	if (value.includes(PEM_BEGIN)) return Buffer.from(value)
	return readFileSync(value.trim())
}

/**
 * mqtt.js TLS fields when a hop CA is configured.
 * @param value - Env value (`MQTT_TLS_CA`)
 * @returns `{ ca }` or an empty object
 */
export const mqttTlsConnectOptions = (value: string): { ca?: Buffer } => {
	const ca = resolveMqttTlsCa(value)
	return ca ? { ca } : {}
}
