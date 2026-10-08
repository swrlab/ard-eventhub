<script setup lang="ts">
import type { ClusterReport, FeedReport, MetaReport } from '../../src/connect/ui/types.ts'
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { formatAge } from './format'
import { tailPhase } from './tail-state'

const route = useRoute()
const now = ref(Date.now())
const meta = ref<MetaReport | null>(null)
const cluster = ref<ClusterReport | null>(null)
const clusterError = ref<string | null>(null)
const feed = ref<FeedReport | null>(null)

provide('now', now)

const nav = [
	{ to: '/on-air', label: 'on-air' },
	{ to: '/feed', label: 'feed' },
	{ to: '/connections', label: 'connections' },
	{ to: '/rejections', label: 'rejections' },
	{ to: '/cluster', label: 'cluster' },
	{ to: '/tail', label: 'tail' },
]

const clusterLine = computed(() => {
	if (clusterError.value && !cluster.value?.nodes.length) return 'monitor unreachable'
	if (!cluster.value) return 'reading monitor'
	const reachable = cluster.value.nodes.filter((node) => node.reachable).length
	const size = cluster.value.clusterSize ?? cluster.value.nodes.length
	const name = cluster.value.cluster ?? 'nats'
	const leader = cluster.value.leader ? `leader ${cluster.value.leader}` : 'no leader'
	return `${name} · ${leader} · ${reachable}/${size}`
})

const feedLine = computed(() => {
	const report = feed.value
	if (!report || !report.source) return report?.lastError ? `feed ${report.lastError}` : 'feed empty'
	const age = formatAge(report.generatedAt, now.value)
	const rev = report.revision === null ? '' : ` · rev ${report.revision}`
	const problem =
		report.lastError && report.outcome !== 'stored' && report.outcome !== 'unchanged' ? ` · ${report.lastError}` : ''
	if (report.staleness === 'never') return `feed ${report.source}${rev}${problem}`
	if (report.staleness === 'ok') return `feed ${age}${rev}${problem}`
	return `feed ${age}${rev} · ${report.staleness}${problem}`
})

const feedTone = computed(() => {
	const report = feed.value
	if (!report) return 'text-muted'
	if (report.lastError && report.outcome !== 'stored' && report.outcome !== 'unchanged') return 'text-warning'
	if (report.staleness === 'warn' || report.staleness === 'alert' || report.staleness === 'page') return 'text-warning'
	return 'text-muted'
})

const load = async (): Promise<void> => {
	if (document.hidden) return
	try {
		const response = await fetch('/api/cluster')
		if (!response.ok) {
			clusterError.value = `${response.status}`
			return
		}
		cluster.value = (await response.json()) as ClusterReport
		clusterError.value = cluster.value.error
		const feedResponse = await fetch('/api/feed')
		if (feedResponse.ok) feed.value = (await feedResponse.json()) as FeedReport
	} catch (error) {
		clusterError.value = error instanceof Error ? error.message : 'monitor unreachable'
	}
}

const onVisible = (): void => {
	if (!document.hidden) void load()
}

let clock: ReturnType<typeof setInterval> | null = null
let poll: ReturnType<typeof setInterval> | null = null

onMounted(() => {
	void fetch('/api/meta')
		.then(async (response) => {
			if (response.ok) meta.value = (await response.json()) as MetaReport
		})
		.catch(() => undefined)
	void load()
	clock = setInterval(() => {
		now.value = Date.now()
	}, 1000)
	poll = setInterval(() => {
		void load()
	}, 8000)
	document.addEventListener('visibilitychange', onVisible)
})

watch(
	() => route.name,
	(name) => {
		document.title = `eventhub connect · ${String(name ?? 'on-air')}`
	},
	{ immediate: true }
)

onUnmounted(() => {
	if (clock) clearInterval(clock)
	if (poll) clearInterval(poll)
	document.removeEventListener('visibilitychange', onVisible)
})
</script>

<template>
	<div class="flex h-dvh flex-col bg-canvas text-text">
		<a
			href="#main"
			class="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-10 focus:bg-heading focus:px-2 focus:py-1 focus:text-canvas"
		>
			Skip to content
		</a>
		<header class="shrink-0 border-b border-border px-4 pt-3 pb-0">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
				<div class="flex items-baseline gap-4">
					<p class="font-mono text-sm whitespace-nowrap text-heading">eventhub connect</p>
					<a
						class="font-mono text-sm text-muted hover:text-link"
						href="https://github.com/swrlab/ard-eventhub"
						target="_blank"
						rel="noreferrer noopener"
					>
						github
					</a>
					<a
						class="font-mono text-sm text-muted hover:text-link"
						href="https://swrlab.github.io/ard-eventhub/"
						target="_blank"
						rel="noreferrer noopener"
					>
						docs
					</a>
				</div>
				<div class="flex min-w-0 flex-col gap-0.5 sm:items-end">
					<p
						class="max-w-full min-w-0 truncate font-mono text-sm tabular-nums"
						:class="clusterError && !cluster?.nodes.length ? 'text-warning' : 'text-muted'"
					>
						{{ clusterLine }}
					</p>
					<RouterLink
						to="/feed"
						class="max-w-full min-w-0 truncate font-mono text-sm tabular-nums hover:text-link"
						:class="feedTone"
					>
						{{ feedLine }}
					</RouterLink>
				</div>
			</div>
			<nav class="mt-3 flex flex-wrap gap-1 font-mono text-sm" aria-label="Boards">
				<RouterLink
					v-for="item in nav"
					:key="item.to"
					:to="item.to"
					class="shrink-0 px-3 py-2 whitespace-nowrap text-muted hover:text-heading"
					exact-active-class="!text-heading"
				>
					{{ item.label }}
				</RouterLink>
			</nav>
		</header>
		<main id="main" class="min-h-0 flex-1 overflow-auto px-4 py-5">
			<RouterView />
		</main>
		<footer class="shrink-0 border-t border-border px-4 py-2 font-mono text-xs text-muted">
			<span>http poll 8s</span>
			<span> · tail {{ tailPhase }}</span>
			<span> · idle 2m</span>
			<span> · cap 30m</span>
			<span v-if="meta"> · {{ meta.user }} · {{ meta.monitor }}</span>
		</footer>
	</div>
</template>
