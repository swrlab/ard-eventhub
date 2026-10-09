<script setup lang="ts">
import type { NatsConnection, Subscription } from '@nats-io/nats-core'
import type { MetaReport, RateWindow, TailEvent } from '#types'
import { wsconnect } from '@nats-io/nats-core'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { natsSubjectToMqttTopic } from '../../../../utils/nats/subjects.ts'
import { DEFAULT_TAIL_FILTER, admitTailEvent, evaluateTail, parseTailFilter, tailCloseMessage } from '../../policy.ts'
import { formatClock } from '../format'
import { tailPhase } from '../tail-state'

/** Read-only browser user from nats-users.conf. No password. Publish still requires both. */
const UI_NATS_USER = 'sub-ui'

const presets = [
	{ label: 'track.playing', filter: 'radio/+/track/playing' },
	{ label: 'track.next', filter: 'radio/+/track/next' },
	{ label: 'control', filter: 'radio/+/control' },
	{ label: 'data', filter: 'radio/+/data' },
	{ label: 'radio', filter: 'radio/#' },
]

const route = useRoute()
const router = useRouter()
const filter = ref(typeof route.query.filter === 'string' ? route.query.filter : DEFAULT_TAIL_FILTER)
const closeMessage = ref<string | null>(null)
const connecting = ref(false)
const events = ref<TailEvent[]>([])
const dropped = ref(0)
const copied = ref<number | null>(null)

let nc: NatsConnection | null = null
let sub: Subscription | null = null
let timer: ReturnType<typeof setInterval> | null = null
let openedAt = 0
let lastBeat = 0
let rate: RateWindow = { windowStart: 0, forwarded: 0, dropped: 0 }
let session = 0

const parsedFilter = computed(() => parseTailFilter(filter.value))
const natsSubject = computed(() => (parsedFilter.value.ok ? parsedFilter.value.subject : ''))
const wide = computed(() => parsedFilter.value.ok && parsedFilter.value.subject.endsWith('>'))
const live = computed(() => tailPhase.value === 'live' || tailPhase.value === 'sampled')

watch(
	() => route.query.filter,
	(value) => {
		if (typeof value === 'string') filter.value = value
	}
)

/**
 * Stop counting presence. A hidden tab must not keep the tail open.
 */
const detachInput = (): void => {
	window.removeEventListener('pointerdown', onActivity)
	window.removeEventListener('keydown', onActivity)
	window.removeEventListener('scroll', onActivity, true)
	document.removeEventListener('visibilitychange', onVisibility)
}

/**
 * Record that someone is at the page. This does not send a NATS keepalive.
 */
const onActivity = (): void => {
	if (!nc || nc.isClosed() || document.hidden) return
	lastBeat = Date.now()
}

/**
 * A tab becoming visible counts as presence. Hiding it does not.
 */
const onVisibility = (): void => {
	if (document.visibilityState !== 'visible') return
	onActivity()
}

/**
 * Close the NATS socket. Idle and the 30 minute cap are checked locally.
 */
const stop = (): void => {
	session += 1
	detachInput()
	if (timer) clearInterval(timer)
	timer = null
	sub?.unsubscribe()
	sub = null
	const closing = nc
	nc = null
	if (closing && !closing.isClosed()) void closing.close()
	tailPhase.value = 'closed'
}

/**
 * Sentence for a NATS error status. Permission failures name the user limit.
 * @param error - Status error
 * @returns Operator-facing sentence
 */
const statusMessage = (error: Error): string => {
	if (error.message.includes('Permissions')) return tailCloseMessage('denied')
	return tailCloseMessage('nats')
}

/**
 * Open a NATS WebSocket subscription. The username is fixed. There is no password.
 */
const watchTail = async (): Promise<void> => {
	const parsed = parseTailFilter(filter.value)
	if (!parsed.ok) {
		closeMessage.value = parsed.error
		return
	}
	filter.value = parsed.topic
	stop()
	const generation = session
	closeMessage.value = null
	events.value = []
	dropped.value = 0
	await router.replace({ query: { filter: parsed.topic } })
	if (generation !== session) return
	let wsUrl = ''
	try {
		const response = await fetch('/api/meta')
		if (!response.ok) throw new Error('meta unavailable')
		const meta = (await response.json()) as MetaReport
		wsUrl = meta.wsUrl
	} catch {
		closeMessage.value = tailCloseMessage('nats')
		return
	}
	if (generation !== session || !wsUrl) {
		if (generation === session) closeMessage.value = tailCloseMessage('nats')
		return
	}
	try {
		connecting.value = true
		const opened = await wsconnect({
			servers: wsUrl,
			user: UI_NATS_USER,
			pass: '',
			reconnect: false,
			timeout: 5_000,
			name: 'eventhub-ui',
		})
		connecting.value = false
		if (generation !== session) {
			await opened.close()
			return
		}
		nc = opened
		openedAt = Date.now()
		lastBeat = openedAt
		rate = { windowStart: openedAt, forwarded: 0, dropped: 0 }
		tailPhase.value = 'live'
		window.addEventListener('pointerdown', onActivity)
		window.addEventListener('keydown', onActivity)
		window.addEventListener('scroll', onActivity, true)
		document.addEventListener('visibilitychange', onVisibility)
		timer = setInterval(() => {
			if (generation !== session) return
			const reason = evaluateTail({ openedAt, lastBeatAt: lastBeat }, Date.now())
			if (!reason) return
			closeMessage.value = tailCloseMessage(reason)
			stop()
		}, 1000)
		void (async () => {
			for await (const status of opened.status()) {
				if (generation !== session) return
				if (status.type === 'error') {
					closeMessage.value = statusMessage(status.error)
					stop()
					return
				}
				if (status.type === 'disconnect' || status.type === 'close') {
					if (!closeMessage.value) closeMessage.value = tailCloseMessage('nats')
					stop()
					return
				}
			}
		})()
		const subscription = opened.subscribe(parsed.subject)
		sub = subscription
		for await (const msg of subscription) {
			if (generation !== session) return
			const now = Date.now()
			const decision = admitTailEvent(rate, now)
			rate = decision.rate
			if (!decision.forward) {
				dropped.value = decision.rate.dropped
				tailPhase.value = 'sampled'
				continue
			}
			const text = msg.string()
			let payload: unknown = text
			if (msg.data.byteLength > 65_536) payload = { truncated: true, bytes: msg.data.byteLength }
			else {
				try {
					payload = JSON.parse(text) as unknown
				} catch {
					payload = text
				}
			}
			events.value.unshift({
				subject: msg.subject,
				at: new Date().toISOString(),
				payload,
				sampled: decision.sampled,
			})
			if (events.value.length > 200) events.value.pop()
			if (decision.sampled) tailPhase.value = 'sampled'
		}
		if (generation === session) {
			if (!closeMessage.value) closeMessage.value = tailCloseMessage('nats')
			stop()
		}
	} catch {
		connecting.value = false
		if (generation !== session) return
		if (!closeMessage.value) closeMessage.value = tailCloseMessage('nats')
		stop()
	}
}

/**
 * Apply a preset MQTT topic and close a live tail so the next watch uses it.
 * @param value - MQTT topic filter
 */
const usePreset = (value: string): void => {
	filter.value = value
	if (live.value) stop()
	void router.replace({ query: { filter: value } })
}

/**
 * Copy one frame's payload.
 * @param payload - Frame body
 * @param index - Row index, used to show which copy succeeded
 */
const copyPayload = async (payload: unknown, index: number): Promise<void> => {
	const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
	await navigator.clipboard.writeText(text)
	copied.value = index
}

/**
 * Pretty-print a frame body.
 * @param payload - Frame body
 * @returns Text for the row
 */
const pretty = (payload: unknown): string => (typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2))

onMounted(() => {
	if (typeof route.query.filter === 'string') void watchTail()
})

onUnmounted(stop)
</script>

<template>
	<section class="flex h-full min-h-0 flex-col">
		<header class="mb-4 max-w-3xl">
			<h1 class="text-xl text-heading">tail</h1>
			<p class="mt-1 text-sm text-muted/80">
				Hier siehst du eingehende Meldungen live. Solange du klickst, tippst oder scrollst, bleibt die Ansicht offen.
				Ein Tab im Hintergrund zählt nicht. Nach 2 Minuten ohne Aktivität ist Schluss, spätestens nach 30 Minuten.
			</p>
		</header>
		<div class="mb-3">
			<form class="flex flex-wrap items-end gap-3" @submit.prevent="watchTail">
				<label class="flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted/80">
					filter
					<input v-model="filter" class="field w-full" spellcheck="false" />
				</label>
				<button type="submit" class="press">
					{{ connecting ? 'connecting' : live ? 'restart' : closeMessage ? 'resume' : 'watch' }}
				</button>
				<button v-if="live" type="button" class="press" @click="stop">stop</button>
			</form>
			<p v-if="natsSubject" class="mt-1 font-mono text-xs text-muted/70">{{ natsSubject }}</p>
		</div>
		<div class="mb-4 flex flex-wrap gap-2">
			<button
				v-for="preset in presets"
				:key="preset.filter"
				type="button"
				class="press"
				:class="filter === preset.filter ? 'text-link' : ''"
				@click="usePreset(preset.filter)"
			>
				{{ preset.label }}
			</button>
		</div>
		<p v-if="wide && !closeMessage" class="mb-3 font-mono text-sm text-warning">
			Der Filter ist sehr weit gefasst. Ab 20 Meldungen pro Sekunde lässt die Ansicht welche aus und markiert sie.
		</p>
		<p v-if="closeMessage" class="mb-3 font-mono text-sm text-warning">{{ closeMessage }}</p>
		<p v-if="tailPhase === 'sampled'" class="mb-3 font-mono text-sm text-warning">sampled · dropped {{ dropped }}</p>
		<p v-if="!events.length && !closeMessage && !live" class="font-mono text-sm text-muted">
			{{ connecting ? 'connecting' : 'not watching' }}
		</p>
		<ol class="min-h-0 flex-1 space-y-4 overflow-auto">
			<li v-for="(item, index) in events" :key="`${item.at}-${index}`" class="border-b border-border pb-3">
				<div class="mb-1 flex items-baseline justify-between gap-3">
					<p class="font-mono text-xs text-muted/80">
						<span>{{ formatClock(item.at) }}</span>
						<span class="text-heading"> {{ natsSubjectToMqttTopic(item.subject) }}</span>
						<span v-if="item.sampled" class="text-warning"> sampled</span>
					</p>
					<button type="button" class="press" @click="copyPayload(item.payload, index)">
						{{ copied === index ? 'copied' : 'copy json' }}
					</button>
				</div>
				<pre class="overflow-x-auto font-mono text-xs leading-5 text-text">{{ pretty(item.payload) }}</pre>
			</li>
		</ol>
	</section>
</template>
