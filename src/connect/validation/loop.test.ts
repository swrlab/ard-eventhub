import { test } from '@cross/test'
import { jetstreamManager } from '@nats-io/jetstream'
import { assert, assertEquals } from '@std/assert'
import { natsAccess } from '../../utils/nats/_client.ts'
import {
	INBOX_STREAM,
	PLUGINS_STREAM,
	VALIDATION_ACK_WAIT_NS,
	VALIDATION_CONSUMER,
	ensureStreams,
} from '../../utils/nats/ensure-streams.ts'
import { inboxMqttTopic, pluginSubject } from '../../utils/nats/subjects.ts'
import { BROKER_PASSWORD, connectMqttUser, skipUnlessNats, tryConnectService } from '../../utils/nats/test-broker.ts'
import { runValidationLoop } from './loop.ts'
import { connectValidationMqtt, createValidationPublisher, validationClientId } from './publish.ts'

const SWR_INSTITUTION_ID = 'urn:ard:institution:a3004ff924ece1a2'
const SHARED_INSTITUTION_ID = 'urn:ard:institution:b71c0e4d9a25f338'
const PUB_SWR = 'pub-swr-2026-06-26'
const SUB_ARD_SOUNDS = 'sub-ard-sounds-2026-06-26'

const LIVESTREAM = 'urn:ard:permanent-livestream:49267f7d67be180d'
const PUBLISHER = 'urn:ard:publisher:75dbb3dace15f610'
const RADIO_TOPIC = `radio/${LIVESTREAM}/track/playing`
const FEEDBACK_TOPIC = `feedback/${SWR_INSTITUTION_ID}`

const owners = new Map([[LIVESTREAM, { publisherId: PUBLISHER, institutionId: SWR_INSTITUTION_ID }]])

type Settlement = { seq: number; redelivered: boolean; action: string }

/**
 * URN-only music now-playing event with no `plugins` array.
 * @param playlistItemId - Correlation id
 * @param institutionId - Claimed institution
 * @returns Inbox JSON
 */
const track = (playlistItemId: string, institutionId = SWR_INSTITUTION_ID) => ({
	event: 'de.ard.eventhub.v1.radio.track.playing',
	type: 'music',
	start: '2026-10-08T12:00:00+02:00',
	length: 180,
	title: 'Song',
	playlistItemId,
	services: [{ id: LIVESTREAM, publisherId: PUBLISHER, institutionId }],
})

/**
 * Poll until a condition holds.
 * @param label - What we were waiting for, included in the timeout error
 * @param pred - Check
 * @returns Resolves when the predicate is true
 */
const waitUntil = async (label: string, pred: () => boolean | Promise<boolean>): Promise<void> => {
	const start = Date.now()
	while (!(await pred())) {
		if (Date.now() - start > 8_000) {
			throw new Error(`timeout: ${label}. Stop \`just dev\` if it is also pulling the validation consumer.`)
		}
		await new Promise((resolve) => {
			setTimeout(resolve, 40)
		})
	}
}

/**
 * Last retained MQTT payload on a topic, from a fresh connection.
 * @param username - MQTT user allowed to subscribe
 * @param topic - MQTT topic
 * @returns Payload text
 */
const retainedText = async (username: string, topic: string): Promise<string> => {
	const client = await connectMqttUser(username, BROKER_PASSWORD)
	try {
		const text = new Promise<string>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error(`no retained message on ${topic}`)), 5_000)
			client.on('message', (got, payload) => {
				if (got !== topic) return
				clearTimeout(timer)
				resolve(payload.toString())
			})
		})
		await client.subscribeAsync(topic, { qos: 1 })
		return await text
	} finally {
		await client.endAsync()
	}
}

test('validation retains a valid event, rejects a bad one, and processes each event once across two pods', async () => {
	const admin = await tryConnectService()
	if (skipUnlessNats(admin)) return

	const acked = new Set<number>()
	let duplicates = 0
	const settlements: Settlement[] = []
	const stops: (() => Promise<void>)[] = []

	const publisher = await connectMqttUser(PUB_SWR, BROKER_PASSWORD)
	try {
		const jsm = await jetstreamManager(admin)
		await ensureStreams(admin)
		const waiting = (await jsm.consumers.info(INBOX_STREAM, VALIDATION_CONSUMER)).num_waiting
		if (waiting > 0) {
			throw new Error(`validation consumer already has ${waiting} pullers; stop just dev before this test`)
		}
		await jsm.streams.purge(INBOX_STREAM)

		const pullers = async (): Promise<number> =>
			(await jsm.consumers.info(INBOX_STREAM, VALIDATION_CONSUMER)).num_waiting

		/**
		 * One validation pod: its own NATS connection and MQTT client id.
		 * @param instance - Client-id suffix
		 * @param beforeAck - Optional hook after publish and before ack. The crash pod closes its connection here.
		 * @returns Stop function
		 */
		const startPod = async (instance: number, beforeAck?: () => Promise<void>): Promise<() => Promise<void>> => {
			const nc = await tryConnectService()
			if (!nc) throw new Error('nats disconnected')
			const mqttClient = await connectValidationMqtt(validationClientId(instance))
			const controller = new AbortController()
			const task = runValidationLoop(nc, {
				signal: controller.signal,
				owners: () => owners,
				publisher: createValidationPublisher(nc, mqttClient),
				...(beforeAck ? { beforeAck } : {}),
				onSettled: (settlement) => {
					settlements.push(settlement)
					if (settlement.action !== 'ack') return
					if (acked.has(settlement.seq)) duplicates += 1
					acked.add(settlement.seq)
				},
			})
			const stop = async (): Promise<void> => {
				controller.abort()
				await task.catch(() => undefined)
				await mqttClient.endAsync().catch(() => undefined)
				if (!nc.isClosed()) await natsAccess.drain(nc).catch(() => undefined)
			}
			stops.push(stop)
			return stop
		}

		const crashLater = async (): Promise<void> => {
			const nc = await tryConnectService()
			if (!nc) throw new Error('nats disconnected')
			const mqttClient = await connectValidationMqtt(validationClientId(4))
			const controller = new AbortController()
			let crashed = false
			const task = runValidationLoop(nc, {
				signal: controller.signal,
				owners: () => owners,
				publisher: createValidationPublisher(nc, mqttClient),
				beforeAck: async () => {
					await nc.close()
					crashed = true
				},
			})
			const stop = async (): Promise<void> => {
				controller.abort()
				await task.catch(() => undefined)
				await mqttClient.endAsync().catch(() => undefined)
				if (!nc.isClosed()) await natsAccess.drain(nc).catch(() => undefined)
			}
			stops.push(stop)
			await waitUntil('crash pod pulling', async () => (await pullers()) >= 1)
			await publisher.publishAsync(inboxMqttTopic(SWR_INSTITUTION_ID), JSON.stringify(track('redeliver-1')), {
				qos: 1,
				retain: false,
			})
			await waitUntil('pod closed before ack', () => crashed)
			await stop()
		}

		await startPod(2)
		await startPod(3)
		await waitUntil('two pods pulling', async () => (await pullers()) >= 2)

		for (let i = 0; i < 8; i += 1) {
			await publisher.publishAsync(inboxMqttTopic(SWR_INSTITUTION_ID), JSON.stringify(track(`once-${i}`)), {
				qos: 1,
				retain: false,
			})
		}
		await waitUntil('eight acks', () => acked.size >= 8 && duplicates === 0)
		assertEquals(duplicates, 0)
		assertEquals(acked.size, 8)

		await publisher.publishAsync(inboxMqttTopic(SWR_INSTITUTION_ID), JSON.stringify(track('retain-me')), {
			qos: 1,
			retain: false,
		})
		await waitUntil('retained event acked', () => acked.size >= 9)
		assertEquals(duplicates, 0)

		const live = JSON.parse(await retainedText(SUB_ARD_SOUNDS, RADIO_TOPIC)) as {
			playlistItemId?: string
		}
		assertEquals(live.playlistItemId, 'retain-me')

		const stored = await jsm.streams.getMessage(PLUGINS_STREAM, {
			last_by_subj: pluginSubject('dts', LIVESTREAM, 'track.playing'),
		})
		assert(stored, 'dts plugin subject missing')
		const pluginBody = JSON.parse(new TextDecoder().decode(stored.data)) as {
			playlistItemId?: string
			plugins?: unknown
		}
		assertEquals(pluginBody.playlistItemId, 'retain-me')
		assertEquals(pluginBody.plugins, undefined)

		const radioplayer = await jsm.streams.getMessage(PLUGINS_STREAM, {
			last_by_subj: pluginSubject('radioplayer', LIVESTREAM, 'track.playing'),
		})
		assert(radioplayer, 'radioplayer plugin subject missing')

		const badSchema = track('bad-schema')
		const { title: _title, ...withoutTitle } = badSchema
		await publisher.publishAsync(inboxMqttTopic(SWR_INSTITUTION_ID), JSON.stringify(withoutTitle), {
			qos: 1,
			retain: false,
		})
		await waitUntil('schema rejection', () => settlements.some((row) => row.action === 'term'))
		const schemaFeedback = JSON.parse(await retainedText(PUB_SWR, FEEDBACK_TOPIC)) as {
			cause?: string
			playlistItemId?: string
		}
		assertEquals(schemaFeedback.cause, 'schema')
		assertEquals(schemaFeedback.playlistItemId, 'bad-schema')
		const stillValid = JSON.parse(await retainedText(SUB_ARD_SOUNDS, RADIO_TOPIC)) as {
			playlistItemId?: string
		}
		assertEquals(stillValid.playlistItemId, 'retain-me')

		const termsBeforeOwner = settlements.filter((row) => row.action === 'term').length
		await publisher.publishAsync(
			inboxMqttTopic(SWR_INSTITUTION_ID),
			JSON.stringify(track('bad-owner', SHARED_INSTITUTION_ID)),
			{ qos: 1, retain: false }
		)
		await waitUntil(
			'ownership rejection',
			() => settlements.filter((row) => row.action === 'term').length > termsBeforeOwner
		)
		const ownerFeedback = JSON.parse(await retainedText(PUB_SWR, FEEDBACK_TOPIC)) as {
			cause?: string
			disagreed?: string[]
			playlistItemId?: string
		}
		assertEquals(ownerFeedback.cause, 'ownership')
		assertEquals(ownerFeedback.playlistItemId, 'bad-owner')
		assertEquals(ownerFeedback.disagreed?.includes('subject'), true)
		assertEquals(duplicates, 0)

		for (const stop of stops.splice(0)) await stop()
		await waitUntil('pullers drained', async () => (await pullers()) === 0)

		await jsm.consumers.update(INBOX_STREAM, VALIDATION_CONSUMER, { ack_wait: 1_000_000_000 })
		const acksBefore = settlements.filter((row) => row.action === 'ack').length
		await crashLater()
		await startPod(5)
		await waitUntil(
			'redelivery acked',
			() =>
				settlements.filter((row) => row.action === 'ack').length > acksBefore &&
				settlements.some((row) => row.action === 'ack' && row.redelivered)
		)
		const again = JSON.parse(await retainedText(SUB_ARD_SOUNDS, RADIO_TOPIC)) as {
			playlistItemId?: string
		}
		assertEquals(again.playlistItemId, 'redeliver-1')
		assertEquals(duplicates, 0)
	} finally {
		for (const stop of stops.splice(0)) await stop()
		try {
			const jsm = await jetstreamManager(admin)
			await jsm.consumers.update(INBOX_STREAM, VALIDATION_CONSUMER, { ack_wait: VALIDATION_ACK_WAIT_NS })
		} catch {
			// The admin connection is already closed.
		}
		await publisher.endAsync().catch(() => undefined)
		if (!admin.isClosed()) await natsAccess.drain(admin)
	}
})
