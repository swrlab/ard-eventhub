import process from 'node:process'
import { logger } from '@frytg/logger'
import mqtt from 'mqtt'
import { GCP_INBOX_FILTER, cnInboxPublish, cnMqttConnectOptions, gcpInboxSubscribe, gcpMqttConnectOptions } from './clients.ts'
import { cnMqttPassword, cnMqttTlsCa, cnMqttUrl, cnMqttUser, gcpMqttUrl, mqttTlsCa } from './env.ts'
import { getBridgeLag, resetBridgeLag } from './lag.ts'
import { relayInbox } from './relay.ts'

const source = 'bridge'
const LAG_LOG_MS = 30_000

/**
 * Subscribe to GCP `inbox/#` and republish each payload onto the CN MQTT inbox.
 * @returns Never resolves unless the process is signalled
 */
const main = async (): Promise<void> => {
	resetBridgeLag()

	const cn = mqtt.connect(cnMqttUrl.trim(), cnMqttConnectOptions(cnMqttTlsCa, cnMqttUser, cnMqttPassword))
	cn.on('connect', () => {
		logger.info({ message: 'cn mqtt connected', source, data: { cnMqttUrl } })
	})
	cn.on('reconnect', () => {
		logger.warning({ message: 'cn mqtt reconnecting', source })
	})
	cn.on('error', (error) => {
		logger.warning({ message: 'cn mqtt error', source, error })
	})

	const publish = async (topic: string, payload: Uint8Array): Promise<void> => {
		await cn.publishAsync(topic, payload, cnInboxPublish)
	}

	logger.info({
		message: 'bridge starting',
		source,
		data: { gcpMqttUrl, cnMqttUrl },
	})

	const gcp = mqtt.connect(gcpMqttUrl.trim(), gcpMqttConnectOptions(mqttTlsCa))
	gcp.on('connect', () => {
		logger.info({ message: 'gcp mqtt connected', source, data: { gcpMqttUrl } })
		void gcp.subscribeAsync(GCP_INBOX_FILTER, gcpInboxSubscribe)
	})
	gcp.on('reconnect', () => {
		logger.warning({ message: 'gcp mqtt reconnecting', source })
	})
	gcp.on('error', (error) => {
		logger.warning({ message: 'gcp mqtt error', source, error })
	})
	gcp.on('message', (topic, payload) => {
		void relayInbox(topic, payload, publish).catch((error: unknown) => {
			logger.warning({
				message: 'bridge relay failed',
				source,
				error,
				data: { topic },
			})
		})
	})

	const lagTimer = setInterval(() => {
		logger.info({ message: 'bridge lag', source, data: getBridgeLag() })
	}, LAG_LOG_MS)
	lagTimer.unref()

	await new Promise<void>((resolve) => {
		const shutdown = (): void => {
			clearInterval(lagTimer)
			gcp.end(true)
			cn.end(true)
			resolve()
		}
		process.on('SIGINT', shutdown)
		process.on('SIGTERM', shutdown)
	})
}

try {
	await main()
} catch (error) {
	logger.error({
		message: 'bridge failed',
		source,
		error,
		data: { gcpMqttUrl, cnMqttUrl },
	})
	process.exit(1)
}
