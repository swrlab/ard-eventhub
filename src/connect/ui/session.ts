import type { NatsConnection } from '@nats-io/transport-node'
import { attachFeedback, createRejectionLog, type RejectionLog } from './rejections.ts'
import { createTailHub, type TailHub } from './tail-hub.ts'

let nc: NatsConnection | null = null
let detachFeedback: (() => void) | null = null

/** Feedback seen while this process is up. */
export const rejectionLog: RejectionLog = createRejectionLog()

/** Live tails. One NATS subscription per filter, shared by every browser. */
export const tail: TailHub = createTailHub(() => nc)

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

/**
 * Close every tail. The HTTP server is stopped by the connect process.
 */
export const stopTail = (): void => {
	tail.stop()
	unbindConnection()
}
