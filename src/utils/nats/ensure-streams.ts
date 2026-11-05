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
/**
 * Durable name of the validation consumer. Kept as `sidecar` on purpose: a new name creates a fresh
 * `DeliverPolicy.All` consumer, which replays the whole INBOX stream into `radio/` and the plugins.
 */
export const VALIDATION_CONSUMER = 'sidecar'

/** Plugin work-queue TTL (RFC §10.4: short max_age in minutes). */
const PLUGINS_MAX_AGE_NS = 10 * 60 * 1_000_000_000

/** Redeliver an unacked inbox message after this long. Nanoseconds. Short on purpose (RFC §10.2). */
export const VALIDATION_ACK_WAIT_NS = 5_000_000_000

/** In-flight inbox messages across the pods pulling the validation consumer. */
const VALIDATION_MAX_ACK_PENDING = 64

/** Crash retries. Validation failures are `term`ed and do not use this budget. */
const VALIDATION_MAX_DELIVER = 3

/** Stream names ensured for eventhub-connect. */
export type EnsuredStreams = {
	inbox: string
	plugins: string
	validation: string
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
 * Create the durable validation pull consumer on INBOX when missing.
 * @param jsm - JetStream manager
 * @returns Consumer name
 */
const ensureValidationConsumer = async (jsm: JetStreamManager): Promise<string> => {
	const tuning = {
		ack_wait: VALIDATION_ACK_WAIT_NS,
		max_ack_pending: VALIDATION_MAX_ACK_PENDING,
		max_deliver: VALIDATION_MAX_DELIVER,
	}
	try {
		await jsm.consumers.info(INBOX_STREAM, VALIDATION_CONSUMER)
		await jsm.consumers.update(INBOX_STREAM, VALIDATION_CONSUMER, tuning)
	} catch (error) {
		if (!isJetStreamCode(error, JetStreamApiCodes.ConsumerNotFound)) {
			throw error
		}
		await jsm.consumers.add(INBOX_STREAM, {
			durable_name: VALIDATION_CONSUMER,
			ack_policy: AckPolicy.Explicit,
			deliver_policy: DeliverPolicy.All,
			replay_policy: ReplayPolicy.Instant,
			filter_subject: 'inbox.>',
			...tuning,
		})
	}
	return VALIDATION_CONSUMER
}

/**
 * Ensure INBOX, PLUGINS, and the durable validation consumer exist (idempotent).
 * @param nc - Open NATS connection
 * @returns Names of the ensured assets
 */
export const ensureStreams = async (nc: NatsConnection): Promise<EnsuredStreams> => {
	const jsm = await jetstreamManager(nc)
	const inbox = await ensureInboxStream(jsm)
	const plugins = await ensurePluginsStream(jsm)
	const validation = await ensureValidationConsumer(jsm)
	return { inbox, plugins, validation }
}
