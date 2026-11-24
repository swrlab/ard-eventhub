import { hostname } from 'node:os'
import process from 'node:process'
import { logger } from '@frytg/logger'
import mqtt, { type MqttClient } from 'mqtt'
import { mqttBrokers, mqttTlsCa } from '#env'
import { mqttBrokerClientOptions, mqttBrokerLabel } from './broker-urls.ts'
import { ingestMqttConnectOptions } from './connect-options.ts'
import { mqttTlsConnectOptions } from './tls-ca.ts'

const source = 'utils.mqtt.client'
const CONNECT_TIMEOUT_MS = 5_000

/**
 * Extra CA for mqtts://. Missing `MQTT_TLS_CA` is fine (local mqtt://).
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
 * One mqtt.js client for the process when `MQTT_BROKER_URL` names a gateway.
 * Undefined otherwise. A comma-separated list is one connection: mqtt.js walks the
 * hosts when the current zone drops. It does not publish a copy to each zone.
 * Authenticates with the shared userinfo. Reconnects on its own; do not call `connect` again.
 */
export const mqttClient: MqttClient | undefined =
	mqttBrokers.servers.length > 0
		? mqtt.connect({
				...ingestMqttConnectOptions(`eventhub-ingest-${hostname()}-${process.pid}`),
				...mqttBrokerClientOptions(mqttBrokers),
				...loadMqttTlsConnectOptions(),
			})
		: undefined

if (mqttBrokers.rejectedHosts.length > 0 || mqttBrokers.invalidCount > 0) {
	logger.warning({
		message: 'mqtt broker list skipped entries',
		source,
		data: {
			rejectedHosts: mqttBrokers.rejectedHosts,
			invalidCount: mqttBrokers.invalidCount,
		},
	})
}

if (mqttClient) {
	logger.info({
		message: 'mqtt brokers configured',
		source,
		data: { hosts: mqttBrokers.servers.map(mqttBrokerLabel) },
	})

	mqttClient.on('connect', () => {
		logger.info({ message: 'mqtt connected', source })
	})

	mqttClient.on('error', (error) => {
		logger.warning({ message: 'mqtt error', source, error })
	})
}

/**
 * Wait until the shared client is connected. Missing `MQTT_BROKER_URL` skips the publish.
 * A down broker is logged, not fatal.
 * @returns Resolves on connect, after the connect timeout, or immediately when MQTT is off
 */
export const startMqttClient = async (): Promise<void> => {
	if (!mqttClient) {
		const unusable = mqttBrokers.invalidCount > 0 || mqttBrokers.rejectedHosts.length > 0
		logger.info({
			message: unusable
				? 'mqtt disabled, MQTT_BROKER_URL has no usable broker'
				: 'mqtt disabled, MQTT_BROKER_URL unset',
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
