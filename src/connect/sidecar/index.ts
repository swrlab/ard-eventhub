import type { NatsConnection } from '@nats-io/transport-node'
import type { MqttClient } from 'mqtt'
import { logger } from '@frytg/logger'
import { runSidecarLoop } from './loop.ts'
import { connectSidecarMqtt, createSidecarPublisher, sidecarClientId } from './publish.ts'

const source = 'connect.sidecar'

/** The running loop and the MQTT connection it publishes on. */
type RunningSidecar = {
	controller: AbortController
	client: MqttClient
	task: Promise<void>
}

let current: RunningSidecar | null = null

/**
 * Pull the inbox and publish validated events. Safe to call again after a reconnect.
 * @param nc - Open NATS connection as `svc-eventhub-connect`
 * @returns Resolves once the MQTT publish connection is up and the loop is running
 */
export const startSidecar = async (nc: NatsConnection): Promise<void> => {
	await stopSidecar()
	const clientId = sidecarClientId(1)
	const client = await connectSidecarMqtt(clientId)
	const controller = new AbortController()
	const task = runSidecarLoop(nc, {
		signal: controller.signal,
		publisher: createSidecarPublisher(nc, client),
	}).catch((error: unknown) => {
		logger.error({ message: 'sidecar loop stopped', source, error })
	})
	current = { controller, client, task }
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
	const stopping = current
	current = null
	if (!stopping) return
	stopping.controller.abort()
	await stopping.task
	try {
		await stopping.client.endAsync()
	} catch {
		// The broker already dropped the session.
	}
}
