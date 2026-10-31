import type { JsMsg } from '@nats-io/jetstream'
import type { NatsConnection } from '@nats-io/transport-node'
import type { ValidationPlan, ValidationPublisher, ValidationSettlement } from '#types'
import { logger } from '@frytg/logger'
import { jetstream } from '@nats-io/jetstream'
import { INBOX_STREAM, VALIDATION_CONSUMER } from '../../utils/nats/ensure-streams.ts'
import { planInboxMessage } from './plan.ts'

const source = 'connect.validation'

/** Prefetch kept under the consumer's `max_ack_pending`. `consume` leaves a pull outstanding. */
const PREFETCH = 32

/** Delay before a publish failure is redelivered. */
const PUBLISH_NAK_MS = 200

/**
 * Run every publish in the plan. Throws on the first failure so the caller can nak.
 * @param publisher - MQTT and NATS publisher
 * @param plan - Planned work
 * @returns Resolves after every publish was acknowledged
 */
const publishPlan = async (publisher: ValidationPublisher, plan: ValidationPlan): Promise<void> => {
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
const settle = (msg: JsMsg, plan: ValidationPlan): void => {
	if (plan.action === 'ack') {
		msg.ack()
		logger.info({
			message: 'validation accepted',
			source,
			data: {
				seq: msg.seq,
				subject: msg.subject,
				plugins: plan.plugins.length,
				payload: plan.payload,
			},
		})
		return
	}
	msg.term(plan.cause)
	logger.log({
		level: plan.cause === 'schema' ? 'error' : 'warning',
		message: 'validation rejected',
		source,
		data: {
			seq: msg.seq,
			subject: msg.subject,
			cause: plan.cause,
			errors: plan.errors,
			payload: plan.payload,
			metric: 'connect.validation.rejection',
		},
	})
}

/**
 * Pull `inbox.>`: plan, publish, then ack or term. Start it only once the feed is in KV (see `serveConnection`).
 * A throw before settling naks the message for redelivery. Returns when the signal aborts or the connection closes.
 * @param nc - NATS connection
 * @param options - Publisher, stop signal, and test hooks
 * @returns Resolves when the loop stops
 */
export const runValidationLoop = async (
	nc: NatsConnection,
	options: {
		signal: AbortSignal
		publisher: ValidationPublisher
		/** Runs after a successful publish and before ack/term. Tests close the connection here. */
		beforeAck?: () => Promise<void>
		/** Called after ack or term. */
		onSettled?: (settlement: ValidationSettlement) => void
	}
): Promise<void> => {
	const { signal, publisher, beforeAck, onSettled } = options
	const stopped = (): boolean => signal.aborted || nc.isClosed()
	const js = jetstream(nc)
	const consumer = await js.consumers.get(INBOX_STREAM, VALIDATION_CONSUMER)
	const messages = await consumer.consume({ max_messages: PREFETCH })
	const stop = (): void => {
		void messages.close()
	}
	signal.addEventListener('abort', stop)

	try {
		for await (const msg of messages) {
			if (stopped()) return
			let plan: ValidationPlan | null = null
			try {
				plan = planInboxMessage({ subject: msg.subject, bytes: msg.data, now: new Date().toISOString() })
				await publishPlan(publisher, plan)
				if (beforeAck) await beforeAck()
				if (stopped()) return
				settle(msg, plan)
				onSettled?.({ seq: msg.seq, redelivered: msg.redelivered, action: plan.action })
			} catch (error) {
				if (stopped()) return
				logger.error({
					message: 'validation publish failed',
					source,
					error,
					data: {
						seq: msg.seq,
						subject: msg.subject,
						deliveryCount: msg.info.deliveryCount,
						action: plan?.action ?? null,
						cause: plan?.action === 'term' ? plan.cause : null,
						payload: plan?.payload ?? null,
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
