import type { JetStreamManager } from '@nats-io/jetstream'
import type { NatsConnection } from '@nats-io/transport-node'
import {
	AckPolicy,
	DeliverPolicy,
	JetStreamApiCodes,
	JetStreamApiError,
	ReplayPolicy,
	StorageType,
	jetstreamManager,
} from '@nats-io/jetstream'

export const INBOX_STREAM = 'INBOX'
export const PLUGINS_STREAM = 'PLUGINS'
export const SIDECAR_CONSUMER = 'sidecar'

/** Plugin work-queue TTL (RFC §10.4: short max_age in minutes). */
const PLUGINS_MAX_AGE_NS = 10 * 60 * 1_000_000_000

/** Stream names ensured for eventhub-connect. */
export type EnsuredStreams = {
	inbox: string
	plugins: string
	sidecar: string
}

/**
 * Whether a JetStream API error is a missing stream or consumer.
 * @param error - Thrown value
 * @param code - JetStream API code to match
 * @returns True when the error is that not-found code
 */
const isJetStreamCode = (error: unknown, code: number): boolean =>
	error instanceof JetStreamApiError && error.code === code

/**
 * Create or update the INBOX stream (`inbox.>`).
 * @param jsm - JetStream manager
 * @returns Stream name
 */
const ensureInboxStream = async (jsm: JetStreamManager): Promise<string> => {
	try {
		await jsm.streams.info(INBOX_STREAM)
		await jsm.streams.update(INBOX_STREAM, { subjects: ['inbox.>'] })
	} catch (error) {
		if (!isJetStreamCode(error, JetStreamApiCodes.StreamNotFound)) {
			throw error
		}
		await jsm.streams.add({
			name: INBOX_STREAM,
			subjects: ['inbox.>'],
			storage: StorageType.File,
		})
	}
	return INBOX_STREAM
}

/**
 * Create or update the PLUGINS stream (`plugin.>`, short max_age).
 * @param jsm - JetStream manager
 * @returns Stream name
 */
const ensurePluginsStream = async (jsm: JetStreamManager): Promise<string> => {
	try {
		await jsm.streams.info(PLUGINS_STREAM)
		await jsm.streams.update(PLUGINS_STREAM, {
			subjects: ['plugin.>'],
			max_age: PLUGINS_MAX_AGE_NS,
		})
	} catch (error) {
		if (!isJetStreamCode(error, JetStreamApiCodes.StreamNotFound)) {
			throw error
		}
		await jsm.streams.add({
			name: PLUGINS_STREAM,
			subjects: ['plugin.>'],
			storage: StorageType.File,
			max_age: PLUGINS_MAX_AGE_NS,
		})
	}
	return PLUGINS_STREAM
}

/**
 * Create the durable `sidecar` pull consumer on INBOX when missing.
 * @param jsm - JetStream manager
 * @returns Consumer name
 */
const ensureSidecarConsumer = async (jsm: JetStreamManager): Promise<string> => {
	try {
		await jsm.consumers.info(INBOX_STREAM, SIDECAR_CONSUMER)
	} catch (error) {
		if (!isJetStreamCode(error, JetStreamApiCodes.ConsumerNotFound)) {
			throw error
		}
		await jsm.consumers.add(INBOX_STREAM, {
			durable_name: SIDECAR_CONSUMER,
			ack_policy: AckPolicy.Explicit,
			deliver_policy: DeliverPolicy.All,
			replay_policy: ReplayPolicy.Instant,
			filter_subject: 'inbox.>',
			max_deliver: 3,
		})
	}
	return SIDECAR_CONSUMER
}

/**
 * Ensure INBOX, PLUGINS, and the durable sidecar consumer exist (idempotent).
 * @param nc - Open NATS connection
 * @returns Names of the ensured assets
 */
export const ensureStreams = async (nc: NatsConnection): Promise<EnsuredStreams> => {
	const jsm = await jetstreamManager(nc)
	const inbox = await ensureInboxStream(jsm)
	const plugins = await ensurePluginsStream(jsm)
	const sidecar = await ensureSidecarConsumer(jsm)
	return { inbox, plugins, sidecar }
}
