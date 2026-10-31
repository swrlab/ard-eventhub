import process from 'node:process'
import { getRequiredEnv } from '@frytg/check-required-env/get'
import { PubSub, type Message } from '@google-cloud/pubsub'
import mqtt from 'mqtt'
import { ulid } from 'ulid'
import { mqttTlsConnectOptions } from '../utils/mqtt/tls-ca.ts'

const MQTT_V311 = 4
const QOS_AT_LEAST_ONCE = 1

const USAGE = 'usage: bun run ./src/cli/pubsub-mqtt.ts <subscription>'

/**
 * Inbox topic for an institution URN. Same shape ingest publishes.
 * @param institutionId - `urn:ard:institution:…`
 * @returns MQTT topic `inbox/{institutionId}`
 */
const inboxTopic = (institutionId: string): string => `inbox/${institutionId}`

/**
 * Institution URN on a pulled event.
 * Prefers a top-level `institutionId` (plugin jobs), then the first service that has one.
 * @param payload - Parsed Pub/Sub JSON
 * @returns `urn:ard:institution:…`, or undefined when the body has none
 */
export const eventInstitutionId = (payload: unknown): string | undefined => {
	if (!payload || typeof payload !== 'object') return undefined
	const record = payload as { institutionId?: unknown; services?: unknown }
	if (typeof record.institutionId === 'string' && record.institutionId.length > 0) return record.institutionId
	if (!Array.isArray(record.services)) return undefined
	for (const service of record.services) {
		if (!service || typeof service !== 'object') continue
		const institutionId = (service as { institutionId?: unknown }).institutionId
		if (typeof institutionId === 'string' && institutionId.length > 0) return institutionId
	}
	return undefined
}

/**
 * Pull one subscription and publish each event to `inbox/{institutionId}`.
 * A successful publish acks. A broker failure nacks so Pub/Sub redelivers.
 * Invalid JSON, or a body with no institution id, is logged and acked so it does not spin.
 * @param subscriptionName - Short name or `projects/…/subscriptions/…`
 * @returns Resolves when MQTT is up and the pull is listening
 */
const relay = async (subscriptionName: string): Promise<void> => {
	const projectId = getRequiredEnv('GCP_PROJECT_ID')
	const brokerUrl = getRequiredEnv('MQTT_BROKER_URL').trim()
	const client = await mqtt.connectAsync(brokerUrl, {
		protocolVersion: MQTT_V311,
		clientId: `eventhub-pubsub-mqtt-${process.pid}-${ulid()}`,
		clean: true,
		...mqttTlsConnectOptions(process.env.MQTT_TLS_CA ?? ''),
	})

	const pubsub = new PubSub({ projectId })
	const subscription = pubsub.subscription(subscriptionName, {
		flowControl: { maxMessages: 1, allowExcessMessages: false },
	})

	/**
	 * Publish one delivery, then ack or nack it.
	 * @param message - Streaming-pull delivery
	 * @returns Resolves after ack or nack
	 */
	const publishMessage = async (message: Message): Promise<void> => {
		let institutionId: string | undefined
		const event = JSON.parse(message.data.toString())
		try {
			institutionId = eventInstitutionId(event)
		} catch (error) {
			console.error(`invalid json id=${message.id}`)
			console.error(error)
			message.ack()
			return
		}

		if (!institutionId) {
			console.error(`skipped, no institutionId id=${message.id}`)
			message.ack()
			return
		}

		event.name = undefined
		if (!event.event) event.event = event.name

		const topic = inboxTopic(institutionId)
		try {
			await client.publishAsync(topic, JSON.stringify(event), { qos: QOS_AT_LEAST_ONCE, retain: false })
			message.ack()
			console.error(`published ${topic} id=${message.id}`)
		} catch (error) {
			console.error(`publish failed ${topic} id=${message.id}`)
			console.error(error)
			message.nack()
		}
	}

	subscription.on('message', (message) => {
		void publishMessage(message)
	})
	subscription.on('error', (error) => {
		console.error(error)
		process.exit(1)
	})

	console.error(`pulling ${subscriptionName} in ${projectId}, publishing to inbox/{institutionId}`)

	const shutdown = async (): Promise<void> => {
		subscription.removeAllListeners()
		await subscription.close()
		await client.endAsync()
		process.exit(0)
	}
	process.once('SIGINT', () => {
		void shutdown()
	})
	process.once('SIGTERM', () => {
		void shutdown()
	})
}

if (import.meta.main) {
	const argv = process.argv.slice(2)
	if (argv.includes('--help') || argv.includes('-h')) {
		console.error(USAGE)
		process.exit(0)
	}
	const subscriptionName = argv[0]
	if (!subscriptionName || argv.length !== 1) {
		console.error(USAGE)
		process.exit(1)
	}
	await relay(subscriptionName)
}
