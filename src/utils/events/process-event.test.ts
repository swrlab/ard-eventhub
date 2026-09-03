import type { ArdPublisher, AuthUser } from '#types'
import type { EventhubV1RadioPostBody } from '../../schemas/events.ts'
import process from 'node:process'
import { test } from '@cross/test'
import { DateTime } from '@frytg/dates'
import { logger } from '@frytg/logger'
import { assertEquals, assertExists, assertMatch } from '@std/assert'
import { createSandbox } from 'sinon'
import { publisherLookup } from '../ard-core.ts'
import { mqttInbox } from '../mqtt/publish-inbox.ts'
import { processEvent, publishEventPlugins, pubsubFanout } from './process-event.ts'

const INSTITUTION_ID = 'urn:ard:institution:swr'
const PUBLISHER_URN = 'urn:ard:publisher:abcdef0123456789'

const user = {
	email: 'lab@swr.de',
	institution: { id: INSTITUTION_ID, name: 'SWR' },
} as AuthUser

/**
 * Minimal HTTPS track body for processEvent tests.
 * @returns Event body
 */
const makeBody = (): Record<string, unknown> => ({
	type: 'speech',
	start: DateTime.now().toISO(),
	title: 'Probe',
	length: 60,
	playlistItemId: 'item-1',
	services: [
		{
			type: 'PermanentLivestream',
			externalId: 'ext-process-event',
			publisherId: PUBLISHER_URN,
		},
	],
})

/**
 * Stub ARD publisher lookup and Pub/Sub fan-out.
 * @returns Sinon sandbox and the Pub/Sub stub
 */
const stubFanout = () => {
	const sandbox = createSandbox()
	sandbox.stub(publisherLookup, 'getById').callsFake(
		(publisherId: string) =>
			({
				id: publisherId,
				title: 'Probe Station',
				institution: { id: INSTITUTION_ID, title: 'SWR' },
			}) as ArdPublisher
	)
	const publishMessage = sandbox.stub(pubsubFanout, 'publishMessage').resolves('pub-1')
	sandbox.stub(logger, 'log')
	return { sandbox, publishMessage }
}

test('processEvent publishes the enriched event to the MQTT inbox', async () => {
	const { sandbox } = stubFanout()
	const publishInbox = sandbox.stub(mqttInbox, 'publish').resolves()

	try {
		const result = await processEvent({
			eventName: 'de.ard.eventhub.v1.radio.track.playing',
			user,
			body: makeBody(),
		})

		assertEquals(publishInbox.calledOnce, true)
		assertEquals(publishInbox.firstCall.args[0], INSTITUTION_ID)
		const payload = publishInbox.firstCall.args[1] as {
			id: string
			services: Array<{
				id?: string
				publisherId?: string
				institutionId?: string
				externalId?: string
				type?: string
				topic?: { messageId?: string | null }
			}>
		}
		assertMatch(payload.id, new RegExp(`^${INSTITUTION_ID}-`))
		assertEquals(payload === result.event, false)
		assertEquals(payload.services[0]?.topic?.messageId, undefined)
		assertMatch(payload.services[0]?.id ?? '', /^urn:ard:permanent-livestream:[a-z0-9]+$/)
		assertEquals(payload.services[0]?.publisherId, PUBLISHER_URN)
		assertEquals(payload.services[0]?.institutionId, INSTITUTION_ID)
		assertEquals(payload.services[0]?.externalId, 'ext-process-event')
		assertEquals(payload.services[0]?.type, 'PermanentLivestream')
		assertEquals(result.event.services[0]?.topic?.messageId, 'pub-1')
		assertEquals(result.statuses.published, 1)
		assertEquals(result.statuses.failed, 0)
	} finally {
		sandbox.restore()
	}
})

test('processEvent normalizes a numeric publisherId before the MQTT inbox hop', async () => {
	const { sandbox } = stubFanout()
	const publishInbox = sandbox.stub(mqttInbox, 'publish').resolves()

	try {
		const result = await processEvent({
			eventName: 'de.ard.eventhub.v1.radio.track.playing',
			user,
			body: {
				...makeBody(),
				services: [
					{
						type: 'PermanentLivestream',
						externalId: 'crid://swr.de/123450',
						publisherId: '248000',
					},
				],
			},
		})

		const payload = publishInbox.firstCall.args[1] as {
			services: Array<{ id?: string; publisherId?: string; institutionId?: string; externalId?: string; type?: string }>
		}
		assertMatch(payload.services[0]?.id ?? '', /^urn:ard:permanent-livestream:[a-z0-9]+$/)
		assertMatch(payload.services[0]?.publisherId ?? '', /^urn:ard:publisher:[a-z0-9]+$/)
		assertEquals(payload.services[0]?.institutionId, INSTITUTION_ID)
		assertEquals(payload.services[0]?.externalId, 'crid://swr.de/123450')
		assertEquals(payload.services[0]?.type, 'PermanentLivestream')
		assertEquals(result.event.services[0]?.publisherId, payload.services[0]?.publisherId)
	} finally {
		sandbox.restore()
	}
})

test('processEvent still returns Pub/Sub statuses when MQTT publish rejects', async () => {
	const { sandbox, publishMessage } = stubFanout()
	sandbox.stub(mqttInbox, 'publish').rejects(new Error('broker down'))
	sandbox.stub(logger, 'warning')

	try {
		const result = await processEvent({
			eventName: 'de.ard.eventhub.v1.radio.track.playing',
			user,
			body: makeBody(),
		})

		assertEquals(result.statuses.published, 1)
		assertEquals(result.statuses.failed, 0)
		assertExists(result.event.id)
		assertEquals(publishMessage.called, true)
	} finally {
		sandbox.restore()
	}
})

test('publishEventPlugins only dispatches when INGEST_PUBLISH_PLUGINS is true', async () => {
	const sandbox = createSandbox()
	const publishMessage = sandbox.stub(pubsubFanout, 'publishMessage').resolves('pub-1')
	const previous = process.env.INGEST_PUBLISH_PLUGINS
	const params = {
		message: {
			plugins: [
				{ type: 'dts', isDeactivated: false },
				{ type: 'radioplayer', isDeactivated: true },
			],
			services: [],
		} as unknown as EventhubV1RadioPostBody,
		user,
		attributes: { event: 'de.ard.eventhub.v1.radio.track.playing' },
		nonBlockedServices: [],
	}

	try {
		delete process.env.INGEST_PUBLISH_PLUGINS
		assertEquals(await publishEventPlugins(params), [])
		assertEquals(publishMessage.called, false)

		process.env.INGEST_PUBLISH_PLUGINS = 'true'
		assertEquals(await publishEventPlugins(params), [{ type: 'dts', messageId: 'pub-1' }])
		assertEquals(publishMessage.calledOnce, true)
	} finally {
		if (previous === undefined) {
			delete process.env.INGEST_PUBLISH_PLUGINS
		} else {
			process.env.INGEST_PUBLISH_PLUGINS = previous
		}
		sandbox.restore()
	}
})
