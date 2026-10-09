<script setup lang="ts">
import type { ClusterReport, MetaReport } from '#types'
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { tailPhase } from './tail-state'

const route = useRoute()
const now = ref(Date.now())
const meta = ref<MetaReport | null>(null)
const cluster = ref<ClusterReport | null>(null)
const clusterError = ref<string | null>(null)
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
		document.title = `ARD Eventhub Connect · ${String(name ?? 'on-air')}`
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
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
				<div class="flex min-w-0 items-center gap-4">
					<RouterLink
						to="/"
						class="inline-flex min-w-0 items-center gap-2 text-base font-semibold whitespace-nowrap text-heading"
					>
						<span aria-hidden="true" class="inline-flex h-5 shrink-0 items-center">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 512 512"
								class="h-5 w-auto"
								fill-rule="evenodd"
								clip-rule="evenodd"
								stroke-linejoin="round"
								stroke-miterlimit="2"
							>
								<path
									d="M255.971 0C115.547 0 .006 115.575.006 256c0 140.424 115.541 256 256 256 140.424 0 256-115.576 256-256 0-1.127-.035-2.287-.035-3.414C510.128 113.425 395.133 0 255.971 0Zm0 464.213h-.034c-114.21 0-208.213-94.003-208.213-208.213 0-1.127 0-2.287.034-3.414 0-114.21 94.003-208.213 208.213-208.213 1.127-.034 2.287-.034 3.414-.034 114.21 0 208.213 94.003 208.213 208.213v.034c0 116.088-95.54 211.627-211.627 211.627Z"
									fill="#ffffff"
								/>
								<path
									d="M337.891 331.093V119.466l-208.213 78.507v51.2l68.267-27.307v160.427l139.946-51.2Z"
									fill="#ffffff"
								/>
							</svg>
						</span>
						<span class="truncate">ARD Eventhub Connect</span>
					</RouterLink>
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
				<p
					class="max-w-full min-w-0 truncate font-mono text-sm tabular-nums sm:text-right"
					:class="clusterError && !cluster?.nodes.length ? 'text-warning' : 'text-muted'"
				>
					{{ clusterLine }}
				</p>
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
