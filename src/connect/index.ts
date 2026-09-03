import type { NatsAccessOptions } from '../utils/nats/_client.ts'
import type { EnsuredStreams } from '../utils/nats/ensure-streams.ts'
import process from 'node:process'
import { logger } from '@frytg/logger'
import { natsAccess } from '../utils/nats/_client.ts'
import { ensureStreams } from '../utils/nats/ensure-streams.ts'
import { natsPassword, natsUrl, natsUser } from './env.ts'

const source = 'connect'

/**
 * Connect to NATS, ensure JetStream assets, and stay up. No consume/validate loop yet.
 * @returns Never resolves unless the process is signalled
 */
const main = async (): Promise<void> => {
	const options: NatsAccessOptions = {
		servers: natsUrl,
		...(natsUser ? { user: natsUser } : {}),
		...(natsPassword ? { password: natsPassword } : {}),
	}
	const nc = await natsAccess.connect(options)
	const streams: EnsuredStreams = await ensureStreams(nc)
	logger.info({
		message: 'nats ready',
		source,
		data: { natsUrl, streams },
	})

	const shutdown = (): void => {
		void natsAccess.drain(nc)
	}
	process.on('SIGINT', shutdown)
	process.on('SIGTERM', shutdown)
	await nc.closed()
}

try {
	await main()
} catch (error) {
	logger.error({
		message: 'nats connect failed',
		source,
		error,
		data: { natsUrl },
	})
	process.exit(1)
}
