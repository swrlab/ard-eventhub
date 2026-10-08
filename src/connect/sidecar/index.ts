import type { NatsConnection } from '@nats-io/transport-node'
import type { MqttClient } from 'mqtt'
import { logger } from '@frytg/logger'
import { runSidecarLoop } from './loop.ts'
import { connectSidecarMqtt, createSidecarPublisher, sidecarClientId } from './publish.ts'

const source = 'connect.sidecar'

let abort: AbortController | null = null
let mqttClient: MqttClient | null = null
let running: Promise<void> | null = null

/**
 * Pull the inbox and publish validated events. Safe to call again after a reconnect.
 * @param nc - Open NATS connection as `svc-sidecar`
 * @returns Resolves once the MQTT publish connection is up and the loop is running
 */
export const startSidecar = async (nc: NatsConnection): Promise<void> => {
	await stopSidecar()
	const clientId = sidecarClientId(1)
	const client = await connectSidecarMqtt(clientId)
	const controller = new AbortController()
	abort = controller
	mqttClient = client
	running = runSidecarLoop(nc, {
		signal: controller.signal,
		publisher: createSidecarPublisher(nc, client),
	}).catch((error: unknown) => {
		logger.error({ message: 'sidecar loop stopped', source, error })
	})
	logger.info({
		message: 'sidecar consuming',
		source,
		data: { clientId, consumer: 'sidecar' },
	})
}

/**
 * Stop the pull loop and the MQTT connection. A second call is a no-op.
 * @returns Resolves when both are closed
 */
export const stopSidecar = async (): Promise<void> => {
	const controller = abort
	const task = running
	const client = mqttClient
	abort = null
	running = null
	mqttClient = null
	controller?.abort()
	if (task) await task
	if (!client) return
	try {
		await client.endAsync()
	} catch {
		// The broker already dropped the session.
	}
}
