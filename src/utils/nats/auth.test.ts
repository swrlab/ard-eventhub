import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { test } from '@cross/test'
import { assert, assertEquals, assertRejects } from '@std/assert'
import { natsAccess } from './_client.ts'
import { inboxMqttTopic, inboxSubject } from './subjects.ts'
import {
	BROKER_PASSWORD,
	MQTT_URL,
	NATS_SERVERS,
	connectMqttUser,
	skipUnlessNats,
	tryConnectSidecar,
} from './test-broker.ts'

const SWR_INSTITUTION_ID = 'urn:ard:institution:a3004ff924ece1a2'
const SHARED_INSTITUTION_ID = 'urn:ard:institution:b71c0e4d9a25f338'
const PUB_SWR = 'pub-swr-2026-06-26'
const PUB_SHARED = 'pub-shared-playout-2026-06-26'
const SUB_ARD_SOUNDS = 'sub-ard-sounds-2026-06-26'
const SVC_INGEST = 'svc-ingest'

const MQTT_V311 = 4
const USERS_FILE = join(import.meta.dir, '../../../.local/nats/nats-users.conf')

/**
 * Publish MQTT QoS 1 and return whether the client accepted it.
 * @param username - Config user
 * @param institutionId - Inbox institution URN
 * @returns Resolves when publish completes
 */
const mqttPublishInbox = async (username: string, institutionId: string): Promise<void> => {
	const client = await connectMqttUser(username, BROKER_PASSWORD)
	try {
		await Promise.race([
			client.publishAsync(inboxMqttTopic(institutionId), JSON.stringify({ from: username }), {
				qos: 1,
				retain: false,
			}),
			new Promise<never>((_, reject) => setTimeout(() => reject(new Error('mqtt publish timeout')), 4_000)),
		])
	} finally {
		await client.endAsync()
	}
}

/**
 * Wait briefly for an inbox message that must not arrive.
 * @param nc - Sidecar connection
 * @param institutionId - Inbox to watch
 * @returns True when a message arrived
 */
const inboxSawMessage = async (
	nc: NonNullable<Awaited<ReturnType<typeof tryConnectSidecar>>>,
	institutionId: string
): Promise<boolean> => {
	const sub = nc.subscribe(inboxSubject(institutionId), { max: 1 })
	const seen = (async () => {
		for await (const message of sub) {
			void message
			return true
		}
		return false
	})()
	return await Promise.race([seen, new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 800))])
}

test('anonymous NATS connect is rejected', async () => {
	const nc = await tryConnectSidecar()
	if (skipUnlessNats(nc)) {
		return
	}
	await natsAccess.drain(nc)
	await assertRejects(() => natsAccess.connect({ servers: NATS_SERVERS }))
})

test('publisher can MQTT-publish to its inbox and not to another institution', async () => {
	const nc = await tryConnectSidecar()
	if (skipUnlessNats(nc)) {
		return
	}
	try {
		const allowed = inboxSawMessage(nc, SWR_INSTITUTION_ID)
		await mqttPublishInbox(PUB_SWR, SWR_INSTITUTION_ID)
		assertEquals(await allowed, true)

		const leaked = inboxSawMessage(nc, SHARED_INSTITUTION_ID)
		await mqttPublishInbox(PUB_SWR, SHARED_INSTITUTION_ID).catch(() => undefined)
		assertEquals(await leaked, false)
	} finally {
		await natsAccess.drain(nc)
	}
})

test('svc-ingest can MQTT-publish to every institution inbox', async () => {
	const nc = await tryConnectSidecar()
	if (skipUnlessNats(nc)) {
		return
	}
	try {
		for (const institutionId of [SWR_INSTITUTION_ID, SHARED_INSTITUTION_ID]) {
			const seen = inboxSawMessage(nc, institutionId)
			await mqttPublishInbox(SVC_INGEST, institutionId)
			assertEquals(await seen, true)
		}
	} finally {
		await natsAccess.drain(nc)
	}
})

test('sub- user cannot publish', async () => {
	const nc = await tryConnectSidecar()
	if (skipUnlessNats(nc)) {
		return
	}
	try {
		const leaked = inboxSawMessage(nc, SWR_INSTITUTION_ID)
		await mqttPublishInbox(SUB_ARD_SOUNDS, SWR_INSTITUTION_ID).catch(() => undefined)
		assertEquals(await leaked, false)
	} finally {
		await natsAccess.drain(nc)
	}
})

test('MQTT credential is rejected on the NATS port; a WebSocket-only user is rejected on MQTT', async () => {
	const nc = await tryConnectSidecar()
	if (skipUnlessNats(nc)) {
		return
	}
	await natsAccess.drain(nc)

	await assertRejects(() =>
		natsAccess.connect({
			servers: NATS_SERVERS,
			user: PUB_SWR,
			password: BROKER_PASSWORD,
		})
	)

	await assertRejects(() =>
		natsAccess.connect({
			servers: NATS_SERVERS,
			user: SVC_INGEST,
			password: BROKER_PASSWORD,
		})
	)

	await assertRejects(() => connectMqttUser('sub-ui', BROKER_PASSWORD))
})

test('multi-institution publisher can MQTT-publish to each allowed inbox', async () => {
	const nc = await tryConnectSidecar()
	if (skipUnlessNats(nc)) {
		return
	}
	try {
		for (const institutionId of [SWR_INSTITUTION_ID, SHARED_INSTITUTION_ID]) {
			const seen = inboxSawMessage(nc, institutionId)
			await mqttPublishInbox(PUB_SHARED, institutionId)
			assertEquals(await seen, true)
		}
	} finally {
		await natsAccess.drain(nc)
	}
})

test('ACL does not inspect payload — shared publisher can misroute a livestream (sidecar step 10)', async () => {
	const nc = await tryConnectSidecar()
	if (skipUnlessNats(nc)) {
		return
	}
	try {
		const payload = {
			type: 'de.ard.eventhub.v1.radio.track.playing',
			services: [{ institutionId: SWR_INSTITUTION_ID }],
		}
		const seen = new Promise<string>((resolve, reject) => {
			const sub = nc.subscribe(inboxSubject(SHARED_INSTITUTION_ID), { max: 1 })
			const timer = setTimeout(() => reject(new Error('timeout')), 5_000)
			void (async () => {
				for await (const msg of sub) {
					clearTimeout(timer)
					resolve(msg.string())
				}
			})()
		})
		const client = await connectMqttUser(PUB_SHARED, BROKER_PASSWORD)
		try {
			await client.publishAsync(inboxMqttTopic(SHARED_INSTITUTION_ID), JSON.stringify(payload), {
				qos: 1,
				retain: false,
			})
		} finally {
			await client.endAsync()
		}
		assertEquals(JSON.parse(await seen).services[0].institutionId, SWR_INSTITUTION_ID)
	} finally {
		await natsAccess.drain(nc)
	}
})

test('hot-reload keeps the sidecar connection and picks up a new MQTT user', async () => {
	const nc = await tryConnectSidecar()
	if (skipUnlessNats(nc)) {
		return
	}

	let original = ''
	try {
		original = await readFile(USERS_FILE, 'utf8')
	} catch {
		console.warn('skip: no writable .local/nats/nats-users.conf (start with just nats-up)')
		await natsAccess.drain(nc)
		return
	}

	const reloadUser = `pub-reload-test-${process.pid}`
	const insertion = `\t\t{ user: "${reloadUser}", password: "${BROKER_PASSWORD}", allowed_connection_types: ["MQTT"], permissions: { publish: { allow: ["inbox.${SWR_INSTITUTION_ID}"] }, subscribe: { allow: ["feedback.${SWR_INSTITUTION_ID}"] } } }\n`
	const updated = original.replace('users: [', `users: [\n${insertion}`)
	const repoRoot = join(import.meta.dir, '../../..')

	try {
		await mkdir(join(repoRoot, '.local/nats'), { recursive: true })
		await writeFile(USERS_FILE, updated)
		assertEquals(spawnSync('just', ['nats-reload'], { cwd: repoRoot, encoding: 'utf8' }).status, 0)
		assert(nc.isClosed() === false)

		const seen = inboxSawMessage(nc, SWR_INSTITUTION_ID)
		const client = await connectMqttUser(reloadUser, BROKER_PASSWORD)
		try {
			await client.publishAsync(inboxMqttTopic(SWR_INSTITUTION_ID), JSON.stringify({ reload: true }), {
				qos: 1,
				retain: false,
			})
		} finally {
			await client.endAsync()
		}
		assertEquals(await seen, true)
	} finally {
		await writeFile(USERS_FILE, original)
		spawnSync('just', ['nats-reload'], { cwd: repoRoot, encoding: 'utf8' })
		if (!nc.isClosed()) {
			await natsAccess.drain(nc)
		}
	}
})

test('MQTT URL without credentials cannot use the gateway', async () => {
	const nc = await tryConnectSidecar()
	if (skipUnlessNats(nc)) {
		return
	}
	await natsAccess.drain(nc)
	const mqtt = await import('mqtt')
	await assertRejects(() =>
		mqtt.default.connectAsync(MQTT_URL, {
			protocolVersion: MQTT_V311,
			connectTimeout: 3_000,
		})
	)
})
