import type { NatsConnection } from '@nats-io/transport-node'
import type { SidecarAction } from './plan.ts'
import type { SidecarPublisher } from './publish.ts'
import { logger } from '@frytg/logger'
import { jetstream } from '@nats-io/jetstream'
import { livestreamOwners, type LivestreamOwner } from '../../utils/feed/known-livestreams.ts'
import { INBOX_STREAM, SIDECAR_CONSUMER } from '../../utils/nats/ensure-streams.ts'
import { feedState } from '../feed/ard-feed.ts'
import { planInboxMessage } from './plan.ts'

const source = 'connect.sidecar'

/** Prefetch kept under the consumer's `max_ack_pending`. `consume` leaves a pull outstanding. */
const PREFETCH = 32

/** Delay before a missing-feed nak is redelivered. */
const FEED_NAK_MS = 1_000

/** Delay before a publish failure is redelivered. */
const PUBLISH_NAK_MS = 200

/** One settled inbox delivery, for tests and the duplicate counter. */
export type SidecarSettlement = {
	seq: number
	redelivered: boolean
	action: SidecarAction
}

/**
 * Pull `inbox.>`, validate, publish, then ack or term.
 * A throw before ack leaves the message for redelivery. Returns when the signal aborts or the connection closes.
 * @param nc - NATS connection
 * @param options - Catalog, publisher, and stop signal
 * @returns Resolves when the loop stops
 */
export const runSidecarLoop = async (
	nc: NatsConnection,
	options: {
		signal: AbortSignal
		/** Defaults to the serving feed. Tests pass a fixed map. */
		owners?: () => Map<string, LivestreamOwner> | null
		publisher: SidecarPublisher
		/** Runs after a successful publish and before ack/term. Tests close the connection here. */
		beforeAck?: () => Promise<void>
		/** Called after ack, term, or nak. */
		onSettled?: (settlement: SidecarSettlement) => void
	}
): Promise<void> => {
	const { signal, publisher, beforeAck, onSettled } = options
	const readOwners = options.owners ?? (() => livestreamOwners(feedState.feed))
	const js = jetstream(nc)
	const consumer = await js.consumers.get(INBOX_STREAM, SIDECAR_CONSUMER)
	const messages = await consumer.consume({ max_messages: PREFETCH })
	const stop = (): void => {
		void messages.close()
	}
	signal.addEventListener('abort', stop)

	try {
		for await (const msg of messages) {
			if (signal.aborted || nc.isClosed()) return
			try {
				const plan = planInboxMessage({
					subject: msg.subject,
					bytes: msg.data,
					owners: readOwners(),
					at: new Date().toISOString(),
				})
				for (const item of plan.mqtt) {
					await publisher.publishRetained(item.topic, item.body)
				}
				for (const item of plan.nats) {
					await publisher.publishPlugin(item.subject, item.body)
				}
				if (plan.action !== 'nak' && beforeAck) await beforeAck()
				if (signal.aborted || nc.isClosed()) return
				if (plan.action === 'term') msg.term(plan.reason ?? 'rejected')
				else if (plan.action === 'nak') msg.nak(plan.reason === 'feed' ? FEED_NAK_MS : PUBLISH_NAK_MS)
				else msg.ack()
				if (plan.action === 'ack') {
					logger.info({
						message: 'sidecar accepted',
						source,
						data: { seq: msg.seq, subject: msg.subject, plugins: plan.nats.length },
					})
				} else if (plan.action === 'term') {
					logger.log({
						level: plan.reason === 'schema' ? 'error' : 'warning',
						message: 'sidecar rejected',
						source,
						data: { seq: msg.seq, subject: msg.subject, cause: plan.reason, metric: 'connect.sidecar.rejection' },
					})
				}
				onSettled?.({ seq: msg.seq, redelivered: msg.redelivered, action: plan.action })
			} catch (error) {
				if (signal.aborted || nc.isClosed()) return
				logger.error({
					message: 'sidecar publish failed',
					source,
					error,
					data: { seq: msg.seq, subject: msg.subject },
				})
				try {
					msg.nak(PUBLISH_NAK_MS)
				} catch {
					return
				}
			}
		}
	} finally {
		signal.removeEventListener('abort', stop)
		await messages.close().catch(() => undefined)
	}
}
