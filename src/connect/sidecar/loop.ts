import type { JsMsg } from '@nats-io/jetstream'
import type { NatsConnection } from '@nats-io/transport-node'
import type { LivestreamOwner } from '../../utils/feed/known-livestreams.ts'
import type { SidecarPlan } from './plan.ts'
import type { SidecarPublisher } from './publish.ts'
import { logger } from '@frytg/logger'
import { jetstream } from '@nats-io/jetstream'
import { INBOX_STREAM, SIDECAR_CONSUMER } from '../../utils/nats/ensure-streams.ts'
import { currentOwners } from '../feed/current-feed.ts'
import { planInboxMessage } from './plan.ts'

const source = 'connect.sidecar'

/** Prefetch kept under the consumer's `max_ack_pending`. `consume` leaves a pull outstanding. */
const PREFETCH = 32

/** Delay before a publish failure is redelivered. */
const PUBLISH_NAK_MS = 200

/** Owner index for the ownership check. Null only before a feed is loaded, which boot rules out. */
export type OwnersReader = () => ReadonlyMap<string, LivestreamOwner> | null

/** One settled inbox delivery, for tests and the duplicate counter. */
export type SidecarSettlement = {
	seq: number
	redelivered: boolean
	action: SidecarPlan['action']
}

/**
 * Run every publish in the plan. Throws on the first failure so the caller can nak.
 * @param publisher - MQTT and NATS publisher
 * @param plan - Planned work
 * @returns Resolves after every publish was acknowledged
 */
const publishPlan = async (publisher: SidecarPublisher, plan: SidecarPlan): Promise<void> => {
	if (plan.action === 'term') {
		if (plan.feedback) await publisher.publishRetained(plan.feedback.topic, plan.feedback.body)
		return
	}
	for (const item of plan.radio) await publisher.publishRetained(item.topic, item.body)
	for (const item of plan.plugins) await publisher.publishPlugin(item.subject, item.body)
}

/**
 * Ack or term the delivery and log the outcome.
 * @param msg - Inbox delivery
 * @param plan - Plan whose publishes already succeeded
 */
const settle = (msg: JsMsg, plan: SidecarPlan): void => {
	if (plan.action === 'ack') {
		msg.ack()
		logger.info({
			message: 'sidecar accepted',
			source,
			data: { seq: msg.seq, subject: msg.subject, plugins: plan.plugins.length },
		})
		return
	}
	msg.term(plan.cause)
	logger.log({
		level: plan.cause === 'schema' ? 'error' : 'warning',
		message: 'sidecar rejected',
		source,
		data: {
			seq: msg.seq,
			subject: msg.subject,
			cause: plan.cause,
			detail: plan.message,
			metric: 'connect.sidecar.rejection',
		},
	})
}

/**
 * Pull `inbox.>`: plan, publish, then ack or term. Start it only once the feed is in KV (see `serveConnection`).
 * A throw before settling naks the message for redelivery. Returns when the signal aborts or the connection closes.
 * @param nc - NATS connection
 * @param options - Catalog, publisher, and stop signal
 * @returns Resolves when the loop stops
 */
export const runSidecarLoop = async (
	nc: NatsConnection,
	options: {
		signal: AbortSignal
		/** Defaults to the serving feed. Tests pass a fixed map. */
		owners?: OwnersReader
		publisher: SidecarPublisher
		/** Runs after a successful publish and before ack/term. Tests close the connection here. */
		beforeAck?: () => Promise<void>
		/** Called after ack or term. */
		onSettled?: (settlement: SidecarSettlement) => void
	}
): Promise<void> => {
	const { signal, publisher, beforeAck, onSettled } = options
	const readOwners = options.owners ?? currentOwners
	const stopped = (): boolean => signal.aborted || nc.isClosed()
	const js = jetstream(nc)
	const consumer = await js.consumers.get(INBOX_STREAM, SIDECAR_CONSUMER)
	const messages = await consumer.consume({ max_messages: PREFETCH })
	const stop = (): void => {
		void messages.close()
	}
	signal.addEventListener('abort', stop)

	try {
		for await (const msg of messages) {
			if (stopped()) return
			let plan: SidecarPlan | null = null
			try {
				const owners = readOwners()
				if (!owners) throw new Error('ard feed is no longer loaded')
				plan = planInboxMessage({ subject: msg.subject, bytes: msg.data, owners, at: new Date().toISOString() })
				await publishPlan(publisher, plan)
				if (beforeAck) await beforeAck()
				if (stopped()) return
				settle(msg, plan)
				onSettled?.({ seq: msg.seq, redelivered: msg.redelivered, action: plan.action })
			} catch (error) {
				if (stopped()) return
				logger.error({
					message: 'sidecar publish failed',
					source,
					error,
					data: {
						seq: msg.seq,
						subject: msg.subject,
						deliveryCount: msg.info.deliveryCount,
						action: plan?.action ?? null,
						cause: plan?.action === 'term' ? plan.cause : null,
					},
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
