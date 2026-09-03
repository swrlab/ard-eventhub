import type { NatsConnection } from '@nats-io/transport-node'
import { connect } from '@nats-io/transport-node'

const CONNECT_TIMEOUT_MS = 5_000

/** Options for a NATS-native connection. */
export type NatsAccessOptions = {
	servers: string
	user?: string
	password?: string
}

/**
 * Open a NATS-native TCP connection.
 * @param options - Server URL and optional user/password
 * @returns Connected NATS client
 */
const connectNats = (options: NatsAccessOptions): Promise<NatsConnection> => {
	const opts: Parameters<typeof connect>[0] = {
		servers: options.servers,
		timeout: CONNECT_TIMEOUT_MS,
		reconnect: true,
		name: 'eventhub-connect',
	}
	if (options.user) {
		opts.user = options.user
	}
	if (options.password) {
		opts.pass = options.password
	}
	return connect(opts)
}

/**
 * Stubbable NATS access used by connect and tests.
 */
export const natsAccess = {
	connect: connectNats,
	/**
	 * Drain in-flight work and close the connection.
	 * @param nc - Open connection
	 * @returns Resolves when the connection is closed
	 */
	drain: (nc: NatsConnection): Promise<void> => nc.drain(),
}
