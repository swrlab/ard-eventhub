import type { NatsConnection } from '@nats-io/transport-node'
import { connect } from '@nats-io/transport-node'
import { parseUserinfoUrl } from '../url-auth.ts'

const CONNECT_TIMEOUT_MS = 5_000

/** Options for a NATS-native connection. */
export type NatsAccessOptions = {
	servers: string
	user?: string
	password?: string
	/** Client name shown in nats-server monitoring. Defaults to `eventhub-connect`. */
	name?: string
}

/**
 * Open a NATS-native TCP connection.
 * Credentials are `user` and `password`. Userinfo on `servers` is dropped and not used.
 * @param options - Server URL and optional user/password
 * @returns Connected NATS client
 */
const connectNats = (options: NatsAccessOptions): Promise<NatsConnection> => {
	const parsed = parseUserinfoUrl(options.servers)
	const opts: Parameters<typeof connect>[0] = {
		servers: parsed.url,
		timeout: CONNECT_TIMEOUT_MS,
		reconnect: true,
		name: options.name ?? 'eventhub-connect',
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
