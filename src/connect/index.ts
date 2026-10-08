import type { NatsConnection } from '@nats-io/transport-node'
import process from 'node:process'
import { logger } from '@frytg/logger'
import { natsAccess } from '../utils/nats/_client.ts'
import { ensureStreams } from '../utils/nats/ensure-streams.ts'
import { natsPassword, natsUrl, natsUser } from './env.ts'
import { startArdFeed, stopArdFeed } from './feed/ard-feed-loader.ts'
import { startSidecar, stopSidecar } from './sidecar/index.ts'
import { natsMonitorUrl, uiHost, uiPort, useHmr } from './ui/env.ts'
import { app } from './ui/server.ts'
import { bindConnection, unbindConnection } from './ui/session.ts'

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

export { app }

/**
 * HTTP server for this process. The runtime listens on this export.
 * `fetch` is the Hono app, so the same app answers `app.request` in tests.
 */
export default {
	hostname: uiHost,
	port: uiPort,
	fetch: app.fetch,
}

/**
 * Keep a NATS connection that ensures JetStream assets and runs the validation sidecar.
 * The HTTP server stays up while this reconnects. It does not listen itself.
 * @returns Never resolves unless the process is signalled
 */
const keepBroker = async (): Promise<void> => {
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
		void (async () => {
			await stopSidecar()
			unbindConnection()
			stopArdFeed()
			if (nc) {
				try {
					await natsAccess.drain(nc)
				} catch {
					// The connection is already gone.
				}
			}
			process.exit(0)
		})()
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
			await startArdFeed(next)
			await startSidecar(next)
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
		await stopSidecar()
		stopArdFeed()
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

if (import.meta.main) {
	void keepBroker().catch((error: unknown) => {
		logger.error({
			message: 'connect failed',
			source,
			error,
			data: { natsUrl },
		})
		process.exit(1)
	})
}
