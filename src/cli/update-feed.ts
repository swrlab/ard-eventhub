import process from 'node:process'
import { logger } from '@frytg/logger'
import { natsPassword, natsUrl, natsUser } from '../connect/env.ts'
import { openArdFeedStore } from '../connect/feed/ard-feed-kv.ts'
import { refreshArdFeedOnce } from '../connect/feed/ard-feed-loader.ts'
import { natsAccess } from '../utils/nats/_client.ts'

const source = 'cli.update-feed'

export const UPDATE_FEED_USAGE = 'usage: bun ./src/cli/update-feed.ts'

/** Dependencies for {@link runUpdateFeed}. */
export type UpdateFeedDeps = {
	connect?: typeof natsAccess.connect
	drain?: typeof natsAccess.drain
	openStore?: typeof openArdFeedStore
	refresh?: typeof refreshArdFeedOnce
}

/**
 * Connect to NATS, refresh the ARD feed in JetStream KV once, and drain the connection.
 * @param deps - Optional overrides for testing
 * @returns Process exit code: 0 on stored or unchanged, 1 when rejected, unavailable, or NATS fails
 */
export const runUpdateFeed = async (deps: UpdateFeedDeps = {}): Promise<number> => {
	const connect = deps.connect ?? natsAccess.connect
	const drain = deps.drain ?? natsAccess.drain
	const openStore = deps.openStore ?? openArdFeedStore
	const refresh = deps.refresh ?? refreshArdFeedOnce

	let nc: Awaited<ReturnType<typeof connect>> | null = null
	try {
		nc = await connect({
			servers: natsUrl,
			...(natsUser ? { user: natsUser } : {}),
			...(natsPassword ? { password: natsPassword } : {}),
			name: 'eventhub-update-feed',
		})
		const store = await openStore(nc)
		const outcome = await refresh(store)
		return outcome === 'stored' || outcome === 'unchanged' ? 0 : 1
	} catch (error) {
		logger.error({
			message: 'ard feed update failed',
			source,
			error,
			data: { natsUrl },
		})
		return 1
	} finally {
		if (nc) {
			try {
				await drain(nc)
			} catch {
				// The connection is already gone.
			}
		}
	}
}

if (import.meta.main) {
	const argv = process.argv.slice(2)
	if (argv.includes('--help') || argv.includes('-h')) {
		console.error(UPDATE_FEED_USAGE)
		process.exit(0)
	}
	if (argv.length > 0) {
		console.error(UPDATE_FEED_USAGE)
		process.exit(1)
	}
	const code = await runUpdateFeed()
	process.exit(code)
}
