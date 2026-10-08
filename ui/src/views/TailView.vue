<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatClock } from '../format'
import { tailPhase } from '../tail-state'

type TailEvent = {
	subject: string
	at: string
	payload: unknown
	sampled: boolean
}

const FILTER_RE = /^(radio|inbox|feedback|plugin)(\.[A-Za-z0-9_:*.>-]+)?$/
const DEFAULT_FILTER = 'radio.*.track.playing'

const presets = [
	{ label: 'track.playing', filter: 'radio.*.track.playing' },
	{ label: 'track.next', filter: 'radio.*.track.next' },
	{ label: 'control', filter: 'radio.*.control' },
	{ label: 'data', filter: 'radio.*.data' },
	{ label: 'feedback', filter: 'feedback.>' },
]

const route = useRoute()
const router = useRouter()
const filter = ref(typeof route.query.filter === 'string' ? route.query.filter : DEFAULT_FILTER)
const closeMessage = ref<string | null>(null)
const events = ref<TailEvent[]>([])
const dropped = ref(0)
const copied = ref<number | null>(null)
let socket: WebSocket | null = null
let lastBeat = 0
let session = 0

const wide = computed(() => filter.value.trim().endsWith('>'))
const live = computed(() => tailPhase.value === 'live' || tailPhase.value === 'sampled')

watch(
	() => route.query.filter,
	(value) => {
		if (typeof value === 'string') filter.value = value
	}
)

const detachInput = (): void => {
	window.removeEventListener('pointerdown', onActivity)
	window.removeEventListener('keydown', onActivity)
	window.removeEventListener('scroll', onActivity, true)
	document.removeEventListener('visibilitychange', onVisibility)
}

const onActivity = (): void => {
	if (!socket || socket.readyState !== WebSocket.OPEN || document.hidden) return
	const now = Date.now()
	if (now - lastBeat < 5_000) return
	lastBeat = now
	socket.send(JSON.stringify({ type: 'beat' }))
}

const onVisibility = (): void => {
	if (document.visibilityState !== 'visible') return
	lastBeat = 0
	onActivity()
}

const stop = (): void => {
	session += 1
	detachInput()
	socket?.close(1000, 'client')
	socket = null
	tailPhase.value = 'closed'
}

const watchTail = async (): Promise<void> => {
	const next = filter.value.trim() || DEFAULT_FILTER
	filter.value = next
	if (!FILTER_RE.test(next)) {
		closeMessage.value = 'filter must start with radio, inbox, feedback, or plugin'
		return
	}
	stop()
	const generation = session
	closeMessage.value = null
	events.value = []
	dropped.value = 0
	await router.replace({ query: { filter: next } })
	if (generation !== session) return
	const url = new URL('/api/tail', window.location.href)
	url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
	url.searchParams.set('filter', next)
	const opened = new WebSocket(url)
	socket = opened
	opened.addEventListener('open', () => {
		if (generation !== session) {
			opened.close()
			return
		}
		tailPhase.value = 'live'
		lastBeat = Date.now()
		window.addEventListener('pointerdown', onActivity)
		window.addEventListener('keydown', onActivity)
		window.addEventListener('scroll', onActivity, true)
		document.addEventListener('visibilitychange', onVisibility)
	})
	opened.addEventListener('message', (event) => {
		if (typeof event.data !== 'string') return
		let body: unknown
		try {
			body = JSON.parse(event.data) as unknown
		} catch {
			return
		}
		if (typeof body !== 'object' || body === null || !('type' in body)) return
		if (body.type === 'close' && 'message' in body && typeof body.message === 'string') {
			closeMessage.value = body.message
			return
		}
		if (body.type === 'sampled' && 'dropped' in body && typeof body.dropped === 'number') {
			dropped.value = body.dropped
			tailPhase.value = 'sampled'
			return
		}
		if (body.type !== 'event' || !('subject' in body) || typeof body.subject !== 'string') return
		const at = 'at' in body && typeof body.at === 'string' ? body.at : new Date().toISOString()
		const sampled = 'sampled' in body && body.sampled === true
		events.value.unshift({ subject: body.subject, at, payload: 'payload' in body ? body.payload : null, sampled })
		if (events.value.length > 200) events.value.pop()
		if (sampled) tailPhase.value = 'sampled'
	})
	opened.addEventListener('close', () => {
		if (generation !== session) return
		detachInput()
		socket = null
		tailPhase.value = 'closed'
		if (!closeMessage.value) closeMessage.value = 'live tail closed'
	})
}

const usePreset = (value: string): void => {
	filter.value = value
	if (live.value) stop()
	void router.replace({ query: { filter: value } })
}

const copyPayload = async (payload: unknown, index: number): Promise<void> => {
	const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
	await navigator.clipboard.writeText(text)
	copied.value = index
}

const pretty = (payload: unknown): string => (typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2))

onUnmounted(stop)
</script>

<template>
	<section class="flex h-full min-h-0 flex-col">
		<header class="mb-4 max-w-3xl">
			<h1 class="text-xl text-heading">tail</h1>
			<p class="mt-1 text-sm text-muted/80">
				Opens only when you ask. A click, key, or scroll keeps it. A hidden tab does not. It stops after 2 minutes idle
				and after 30 minutes anyway.
			</p>
		</header>
		<form class="mb-3 flex flex-wrap items-end gap-3" @submit.prevent="watchTail">
			<label class="flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted/80">
				filter
				<input v-model="filter" class="field w-full" spellcheck="false" />
			</label>
			<button type="submit" class="press">{{ live ? 'restart' : closeMessage ? 'resume' : 'watch' }}</button>
			<button v-if="live" type="button" class="press" @click="stop">stop</button>
		</form>
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
		<p v-if="wide" class="mb-3 font-mono text-sm text-warning">
			wide filter. frames over 20/s are dropped and marked sampled.
		</p>
		<p v-if="closeMessage" class="mb-3 font-mono text-sm text-warning">{{ closeMessage }}</p>
		<p v-if="tailPhase === 'sampled'" class="mb-3 font-mono text-sm text-warning">sampled · dropped {{ dropped }}</p>
		<p v-if="!events.length && !closeMessage" class="font-mono text-sm text-muted">not watching</p>
		<ol class="min-h-0 flex-1 space-y-4 overflow-auto">
			<li v-for="(item, index) in events" :key="`${item.at}-${index}`" class="border-b border-border pb-3">
				<div class="mb-1 flex items-baseline justify-between gap-3">
					<p class="font-mono text-xs text-muted/80">
						<span>{{ formatClock(item.at) }}</span>
						<span class="text-heading"> {{ item.subject }}</span>
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
