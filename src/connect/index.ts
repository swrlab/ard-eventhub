import type { NatsConnection } from '@nats-io/transport-node'
import process from 'node:process'
import { logger } from '@frytg/logger'
import { natsAccess } from '../utils/nats/_client.ts'
import { ensureStreams } from '../utils/nats/ensure-streams.ts'
import { natsPassword, natsUrl, natsUser } from './env.ts'
import { natsMonitorUrl, uiHost, uiPort, useHmr } from './ui/env.ts'
import uiServer from './ui/server.ts'
import { bindConnection, stopTail, unbindConnection } from './ui/session.ts'

const source = 'connect'

/**
 * Wait before the next NATS attempt so a down broker does not spin.
 * @param ms - Delay
 * @returns Resolves after the delay
 */
const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms)
	})

/**
 * Serve the operator UI and keep a NATS connection that ensures JetStream assets.
 * The HTTP server stays up while NATS reconnects.
 * @returns Never resolves unless the process is signalled
 */
const main = async (): Promise<void> => {
	const http = Bun.serve(uiServer)
	logger.info({
		message: 'operator ui listening',
		source: 'connect.ui',
		data: { host: uiHost, port: uiPort, hmr: useHmr, monitor: natsMonitorUrl, natsUrl, user: natsUser },
	})

	let stopped = false
	let nc: NatsConnection | null = null

	const shutdown = (): void => {
		if (stopped) return
		stopped = true
		stopTail()
		http.stop()
		if (nc) void natsAccess.drain(nc)
		process.exit(0)
	}
	process.on('SIGINT', shutdown)
	process.on('SIGTERM', shutdown)

	for (;;) {
		if (stopped) return
		try {
			const next = await natsAccess.connect({
				servers: natsUrl,
				...(natsUser ? { user: natsUser } : {}),
				...(natsPassword ? { password: natsPassword } : {}),
			})
			nc = next
			const streams = await ensureStreams(next)
			bindConnection(next)
			logger.info({
				message: 'nats ready',
				source,
				data: { natsUrl, streams },
			})
			await next.closed()
		} catch (error) {
			logger.error({
				message: 'nats connect failed',
				source,
				error,
				data: { natsUrl },
			})
		}
		unbindConnection()
		if (nc) {
			const dying = nc
			nc = null
			try {
				await natsAccess.drain(dying)
			} catch {
				// The connection is already gone.
			}
		}
		if (stopped) return
		await sleep(3_000)
	}
}

try {
	await main()
} catch (error) {
	logger.error({
		message: 'connect failed',
		source,
		error,
		data: { natsUrl },
	})
	process.exit(1)
}
