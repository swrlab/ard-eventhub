import { hostname } from 'node:os'
import process from 'node:process'
import { logger } from '@frytg/logger'
import mqtt from 'mqtt'
import { mqttBrokerUrl } from '#env'

const source = 'utils.mqtt.client'
const MQTT_V311 = 4
const CONNECT_TIMEOUT_MS = 5_000

/**
 * One mqtt.js client for the process. Reconnects on its own; do not call `connect` again.
 */
export const mqttClient = mqtt.connect(mqttBrokerUrl.trim(), {
	clientId: `eventhub-ingest-${hostname()}-${process.pid}`,
	protocolVersion: MQTT_V311,
	connectTimeout: CONNECT_TIMEOUT_MS,
})

mqttClient.on('error', (error) => {
	logger.warning({ message: 'mqtt error', source, error })
})

/**
 * Wait until the shared client is connected. A down broker is logged, not fatal.
 * @returns Resolves on connect or after the connect timeout
 */
export const startMqttClient = async (): Promise<void> => {
	try {
		await new Promise<void>((resolve, reject) => {
			if (mqttClient.connected) return resolve()
			const timer = setTimeout(() => reject(new Error('mqtt connect timeout')), CONNECT_TIMEOUT_MS)
			mqttClient.once('connect', () => {
				clearTimeout(timer)
				resolve()
			})
		})
	} catch (error) {
		logger.warning({
			message: 'mqtt client not connected yet',
			source,
			error,
		})
	}
}
