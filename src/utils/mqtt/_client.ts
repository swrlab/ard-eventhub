import { hostname } from 'node:os'
import process from 'node:process'
import { logger } from '@frytg/logger'
import mqtt, { type MqttClient } from 'mqtt'
import { mqttBrokerUrl, mqttTlsCa } from '#env'
import { mqttTlsConnectOptions } from './tls-ca.ts'

const source = 'utils.mqtt.client'
const MQTT_V311 = 4
const CONNECT_TIMEOUT_MS = 5_000

/**
 * True when `MQTT_BROKER_URL` names a broker. Blank means legacy ingest with no hop.
 * @param brokerUrl - Raw `MQTT_BROKER_URL`
 * @returns Whether the hop should start
 */
export const isMqttBrokerConfigured = (brokerUrl: string): boolean => brokerUrl.trim().length > 0

/**
 * Extra hop CA for mqtts://. Missing `MQTT_TLS_CA` is fine (local mqtt://).
 * An unreadable path is logged; the client still starts so HTTPS ingest stays up.
 * @returns mqtt.js `ca` option, or an empty object
 */
const loadMqttTlsConnectOptions = (): ReturnType<typeof mqttTlsConnectOptions> => {
	try {
		return mqttTlsConnectOptions(mqttTlsCa)
	} catch (error) {
		logger.warning({
			message: 'mqtt tls ca unreadable',
			source,
			error,
			data: { mqttTlsCa },
		})
		return {}
	}
}

/**
 * One mqtt.js client for the process when a broker URL is set. Undefined otherwise.
 * Reconnects on its own; do not call `connect` again.
 */
export const mqttClient: MqttClient | undefined = isMqttBrokerConfigured(mqttBrokerUrl)
	? mqtt.connect(mqttBrokerUrl.trim(), {
			clientId: `eventhub-ingest-${hostname()}-${process.pid}`,
			protocolVersion: MQTT_V311,
			connectTimeout: CONNECT_TIMEOUT_MS,
			...loadMqttTlsConnectOptions(),
		})
	: undefined

if (mqttClient) {
	mqttClient.on('connect', () => {
		logger.info({ message: 'mqtt connected', source })
	})

	mqttClient.on('error', (error) => {
		logger.warning({ message: 'mqtt error', source, error })
	})
}

/**
 * Wait until the shared client is connected. Missing `MQTT_BROKER_URL` skips the hop.
 * A down broker is logged, not fatal.
 * @returns Resolves on connect, after the connect timeout, or immediately when MQTT is off
 */
export const startMqttClient = async (): Promise<void> => {
	if (!mqttClient) {
		logger.info({
			message: 'mqtt disabled, MQTT_BROKER_URL unset',
			source,
		})
		return
	}

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
