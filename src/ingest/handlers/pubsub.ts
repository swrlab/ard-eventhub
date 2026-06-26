/*

	ard-eventhub
	by SWR Audio Lab

*/

import logger from '@frytg/logger'
import type { Context } from 'hono'

import dtsEvent from '@/src/utils/plugins/dts/event.ts'
import radioplayerEvent from '@/src/utils/plugins/radioplayer/event.ts'

const source = 'ingest/pubsub'

export default async (c: Context) => {
	let body: Record<string, any> = {}

	try {
		body = await c.req.json<Record<string, any>>()
		const attributes = body?.message?.attributes
		const messageId = body?.message?.messageId
		const { subscription } = body

		let job = body?.message?.data ? Buffer.from(body.message.data, 'base64').toString() : body
		job = c.req.header('x-skip-parsing') ? job : JSON.parse(job)

		job.messageId = messageId
		job.attributes = attributes
		job.subscription = subscription

		if (job.action === 'plugins.dts.event') {
			await dtsEvent(job)
		} else if (job.action === 'plugins.radioplayer.event') {
			await radioplayerEvent(job)
		} else {
			logger.log({
				level: 'warning',
				message: 'undetected PubSub message action',
				source,
				data: { messageId, job, headers: Object.fromEntries(c.req.raw.headers) },
			})
		}

		return c.body(null, 201)
	} catch (error) {
		const messageId = body?.message?.messageId
		logger.log({
			level: 'error',
			message: 'error while processing PubSub message',
			source,
			error,
			data: { messageId, body, headers: Object.fromEntries(c.req.raw.headers) },
		})

		return c.body(null, 204)
	}
}
