import type { NatsConnection } from '@nats-io/transport-node'
import type { RunningValidation } from '#types'
import { logger } from '@frytg/logger'
import { VALIDATION_CONSUMER } from '../../utils/nats/ensure-streams.ts'
import { runValidationLoop } from './loop.ts'
import { connectValidationMqtt, createValidationPublisher, validationClientId } from './publish.ts'

const source = 'connect.validation'

let current: RunningValidation | null = null

/**
 * Pull the inbox and publish validated events. Safe to call again after a reconnect.
 * @param nc - Open NATS connection as `svc-eventhub-connect`
 * @returns Resolves once the MQTT publish connection is up and the loop is running
 */
export const startValidation = async (nc: NatsConnection): Promise<void> => {
	await stopValidation()
	const clientId = validationClientId(1)
	const client = await connectValidationMqtt(clientId)
	const controller = new AbortController()
	const task = runValidationLoop(nc, {
		signal: controller.signal,
		publisher: createValidationPublisher(nc, client),
	}).catch((error: unknown) => {
		logger.error({ message: 'validation loop stopped', source, error })
	})
	current = { controller, client, task }
	logger.info({
		message: 'validation consuming',
		source,
		data: { clientId, consumer: VALIDATION_CONSUMER },
	})
}

/**
 * Stop the pull loop and the MQTT connection. A second call is a no-op.
 * @returns Resolves when both are closed
 */
export const stopValidation = async (): Promise<void> => {
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
