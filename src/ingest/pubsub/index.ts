import type { Context } from 'hono'
import logger from '@frytg/logger'
import dtsEvent from '../../utils/plugins/dts/event.ts'
import radioplayerEvent from '../../utils/plugins/radioplayer/event.ts'

const source = 'ingest/pubsub'

/**
 * Handle Pub/Sub push (and task) deliveries for plugin actions.
 * @param c - Hono context
 * @returns Empty success/error status
 */
export default async (c: Context) => {
	let body: Record<string, unknown> = {}
	try {
		body = await c.req.json()

		// get metadata from pubsub body
		const message = body?.message as Record<string, unknown> | undefined
		const attributes = message?.attributes
		const messageId = message?.messageId
		const { subscription } = body

		// get message from pubsub or tasks
		let job: unknown = message?.data ? Buffer.from(String(message.data), 'base64').toString() : body
		job = c.req.header('x-skip-parsing') ? job : JSON.parse(job as string)

		const jobRecord = job as Record<string, unknown>

		// insert data into job
		jobRecord.messageId = messageId
		jobRecord.attributes = attributes
		jobRecord.subscription = subscription

		// handle actions
		if (jobRecord.action === 'plugins.dts.event') {
			// oxlint-disable-next-line typescript/no-explicit-any -- Pub/Sub job payload is dynamically shaped
			await dtsEvent(jobRecord as any)
		} else if (jobRecord.action === 'plugins.radioplayer.event') {
			// oxlint-disable-next-line typescript/no-explicit-any -- Pub/Sub job payload is dynamically shaped
			await radioplayerEvent(jobRecord as any)
		} else {
			logger.log({
				level: 'warning',
				message: 'undetected PubSub message action',
				source,
				data: { messageId, job: jobRecord, headers: Object.fromEntries(c.req.raw.headers) },
			})
		}

		// return ok
		return c.body(null, 201)
	} catch (error) {
		const message = body?.message as Record<string, unknown> | undefined
		const messageId = message?.messageId
		logger.log({
			level: 'error',
			message: 'error while processing PubSub message',
			source,
			error,
			data: {
				messageId,
				body,
				headers: Object.fromEntries(c.req.raw.headers),
			},
		})

		return c.body(null, 204)
	}
}
