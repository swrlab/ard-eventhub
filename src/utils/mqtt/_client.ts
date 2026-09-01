import type { IClientOptions, MqttClient } from 'mqtt'
import { hostname } from 'node:os'
import mqtt from 'mqtt'
import { mqttBrokerUrl } from '#env'

const MQTT_V311 = 4
const CONNECT_TIMEOUT_MS = 5_000

/**
 * Live MQTT settings. Tests stub these methods instead of `process.env`.
 */
export const mqttSettings = {
	/**
	 * Broker connection string (`mqtt://` or `mqtts://`, credentials in the URL).
	 * @returns Trimmed `MQTT_BROKER_URL`
	 */
	brokerUrl(): string {
		return mqttBrokerUrl.trim()
	},
	/**
	 * Stable per-pod client id from the OS hostname.
	 * @returns `eventhub-ingest-${hostname()}`
	 */
	clientId(): string {
		return `eventhub-ingest-${hostname()}`
	},
}

/**
 * mqtt.js connect wrapper. Tests stub `connect`.
 */
export const mqttFactory = {
	/**
	 * Open an MQTT client against the broker URL.
	 * @param url - Broker connection string
	 * @param options - mqtt.js connect options
	 * @returns Connected-or-connecting client
	 */
	connect(url: string, options: IClientOptions): MqttClient {
		return mqtt.connect(url, options)
	},
}

/**
 * Process-wide MQTT client. Cleared after a failed connect so the next publish retries.
 */
export const mqttClientCache: { current: MqttClient | undefined } = {
	current: undefined,
}

/**
 * Build mqtt.js connect options for MQTT 3.1.1.
 * Auth stays in `MQTT_BROKER_URL` when the broker needs it.
 * @returns Connect options
 */
const buildConnectOptions = (): IClientOptions => ({
	clientId: mqttSettings.clientId(),
	protocolVersion: MQTT_V311,
	clean: true,
	connectTimeout: CONNECT_TIMEOUT_MS,
})

/**
 * Wait until the client is connected or fail.
 * @param client - mqtt.js client
 * @returns Resolves on connect
 */
const waitForConnect = (client: MqttClient): Promise<void> => {
	if (client.connected) return Promise.resolve()

	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			client.off('connect', onConnect)
			client.off('error', onError)
			reject(new Error('mqtt connect timeout'))
		}, CONNECT_TIMEOUT_MS)

		const onConnect = () => {
			clearTimeout(timer)
			client.off('error', onError)
			resolve()
		}

		const onError = (error: Error) => {
			clearTimeout(timer)
			client.off('connect', onConnect)
			reject(error)
		}

		client.once('connect', onConnect)
		client.once('error', onError)
	})
}

/**
 * Return a connected MQTT client.
 * @returns Connected client
 */
export const getMqttClient = async (): Promise<MqttClient> => {
	const existing = mqttClientCache.current
	if (existing?.connected) return existing

	const client = mqttFactory.connect(mqttSettings.brokerUrl(), buildConnectOptions())
	mqttClientCache.current = client

	try {
		await waitForConnect(client)
		return client
	} catch (error) {
		mqttClientCache.current = undefined
		client.end(true)
		throw error
	}
}
