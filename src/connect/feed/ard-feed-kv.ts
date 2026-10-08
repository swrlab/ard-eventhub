import type { NatsConnection } from '@nats-io/transport-node'
import type { ArdFeed } from '#types'
import type { ArdFeedStore, FeedSnapshot } from './ard-feed.ts'
import { logger } from '@frytg/logger'
import {
	DeliverPolicy,
	DiscardPolicy,
	JetStreamApiCodes,
	JetStreamApiError,
	RetentionPolicy,
	StorageType,
	jetstream,
	jetstreamManager,
} from '@nats-io/jetstream'
import { headers } from '@nats-io/transport-node'
import { getArdFeedValidationError } from '../../utils/feed/ard-feed-rules.ts'
import { ARD_FEED_STREAM, ARD_FEED_SUBJECT } from './ard-feed.ts'

const source = 'connect.ard-feed'
const HISTORY = 48
const MAX_BYTES = 64 * 1024 * 1024
/** Leave room under the server `max_payload` (1 MiB) for the publish headers. */
const MAX_BODY_BYTES = 1_000_000
const PREFERRED_REPLICAS = 3
/** Ordered consumers are dropped after this idle stretch. Nanoseconds. */
const WATCH_IDLE_NS = 5 * 60 * 1_000_000_000

/**
 * Whether a JetStream API error is a specific code.
 * @param error - Thrown value
 * @param code - JetStream API code
 * @returns True when it matches
 */
const isCode = (error: unknown, code: number): boolean => error instanceof JetStreamApiError && error.code === code

/**
 * Whether the cluster refused a 3-replica stream.
 * @param error - Thrown value
 * @returns True when a single-node broker is the likely cause
 */
const isReplicaError = (error: unknown): boolean => {
	if (!(error instanceof Error)) return false
	const text = error.message.toLowerCase()
	return text.includes('replica') || text.includes('insufficient resources') || text.includes('cluster size')
}

/**
 * Decode a stored payload. Invalid JSON or a failed integrity check returns null.
 * @param data - Message body
 * @param revision - Stream sequence
 * @returns A snapshot, or null
 */
const decodeSnapshot = (data: Uint8Array, revision: number): FeedSnapshot | null => {
	try {
		const parsed: unknown = JSON.parse(new TextDecoder().decode(data))
		if (getArdFeedValidationError(parsed)) return null
		return { feed: parsed as ArdFeed, revision }
	} catch {
		return null
	}
}

/**
 * Stream config for the feed bucket.
 * @param replicas - RAFT copies. One on a single node, three on the dev cluster
 * @returns JetStream stream config
 */
const feedStreamConfig = (replicas: number) => ({
	name: ARD_FEED_STREAM,
	subjects: ['$KV.ARD_FEED.>'],
	storage: StorageType.File,
	retention: RetentionPolicy.Limits,
	discard: DiscardPolicy.Old,
	max_msgs_per_subject: HISTORY,
	max_bytes: MAX_BYTES,
	max_msg_size: 1_048_576,
	num_replicas: replicas,
	allow_direct: true,
})

/**
 * Create the feed stream when it is missing. Three replicas on a cluster, one on a single node.
 * @param nc - Open NATS connection
 */
const ensureBucket = async (nc: NatsConnection): Promise<void> => {
	const jsm = await jetstreamManager(nc)
	try {
		await jsm.streams.info(ARD_FEED_STREAM)
		return
	} catch (error) {
		if (!isCode(error, JetStreamApiCodes.StreamNotFound)) throw error
	}

	try {
		await jsm.streams.add(feedStreamConfig(PREFERRED_REPLICAS))
		logger.info({ message: 'ard feed bucket created', source, data: { replicas: PREFERRED_REPLICAS } })
	} catch (error) {
		if (!isReplicaError(error)) throw error
		await jsm.streams.add(feedStreamConfig(1))
		logger.info({ message: 'ard feed bucket created', source, data: { replicas: 1 } })
	}
}

/**
 * Open the JetStream bucket the hourly pull writes and the process watches.
 * @param nc - Open NATS connection. `svc-sidecar` must be allowed to publish `$KV.ARD_FEED.>`
 * @returns A store bound to that connection
 */
export const openArdFeedStore = async (nc: NatsConnection): Promise<ArdFeedStore> => {
	await ensureBucket(nc)
	const jsm = await jetstreamManager(nc)
	const js = jetstream(nc)

	return {
		/**
		 * Last message on the feed subject.
		 * @returns The snapshot, or null when the subject is empty or the bytes fail validation
		 */
		async read(): Promise<FeedSnapshot | null> {
			try {
				const msg = await jsm.streams.getMessage(ARD_FEED_STREAM, { last_by_subj: ARD_FEED_SUBJECT })
				if (!msg) return null
				return decodeSnapshot(msg.data, msg.seq)
			} catch (error) {
				if (isCode(error, JetStreamApiCodes.StreamNotFound) || isCode(error, JetStreamApiCodes.NoMessageFound)) {
					return null
				}
				throw error
			}
		},

		/**
		 * Publish the document as the next revision.
		 * @param feed - Accepted feed
		 * @returns The ack sequence
		 */
		async write(feed: ArdFeed): Promise<FeedSnapshot> {
			const body = new TextEncoder().encode(JSON.stringify(feed))
			if (body.byteLength > MAX_BODY_BYTES) {
				throw new Error(`ard feed is too large > ${body.byteLength}`)
			}
			const hdrs = headers()
			hdrs.set('KV-Operation', 'PUT')
			const ack = await js.publish(ARD_FEED_SUBJECT, body, { headers: hdrs })
			return { feed, revision: ack.seq }
		},

		/**
		 * Deliver new revisions. Failures are logged. The hourly pull still writes.
		 * @param onSnapshot - Called with a validated revision
		 * @returns Closes the consumer
		 */
		watch(onSnapshot: (snapshot: FeedSnapshot) => void): () => void {
			let closed = false
			let closeMessages: (() => void) | null = null
			void (async () => {
				try {
					const consumer = await js.consumers.get(ARD_FEED_STREAM, {
						filter_subjects: ARD_FEED_SUBJECT,
						deliver_policy: DeliverPolicy.New,
						inactive_threshold: WATCH_IDLE_NS,
					})
					const messages = await consumer.consume()
					closeMessages = () => {
						void messages.close()
					}
					for await (const msg of messages) {
						if (closed) break
						const op = msg.headers?.get('KV-Operation')
						if (!op || op === 'PUT') {
							const snapshot = decodeSnapshot(msg.data, msg.seq)
							if (snapshot) onSnapshot(snapshot)
							else {
								logger.warning({
									message: 'ard feed snapshot rejected',
									source,
									data: { revision: msg.seq },
								})
							}
						}
						msg.ack()
					}
				} catch (error) {
					if (closed) return
					logger.error({ message: 'ard feed watch failed', source, error })
				}
			})()
			return () => {
				closed = true
				closeMessages?.()
			}
		},
	}
}
