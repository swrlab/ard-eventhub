import type { NatsConnection } from '@nats-io/transport-node'
import type { RejectionLog } from '#types'
import { attachFeedback, createRejectionLog } from './rejections.ts'

let nc: NatsConnection | null = null
let detachFeedback: (() => void) | null = null

/** Feedback seen while this process is up. */
export const rejectionLog: RejectionLog = createRejectionLog()

/**
 * NATS connection the boards read from. Null until connect binds one.
 * @returns The open connection, or null
 */
export const currentConnection = (): NatsConnection | null => nc

/**
 * Use this connection for retained reads and the feedback ring.
 * @param next - Connection owned by the connect process
 */
export const bindConnection = (next: NatsConnection): void => {
	nc = next
	detachFeedback?.()
	detachFeedback = attachFeedback(next, rejectionLog)
}

/**
 * Drop the feedback subscription. Retained reads wait until the next bind.
 */
export const unbindConnection = (): void => {
	detachFeedback?.()
	detachFeedback = null
	nc = null
}
