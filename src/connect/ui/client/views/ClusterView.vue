<script setup lang="ts">
import type { ClusterReport } from '#types'
import { computed } from 'vue'
import { formatBytes, formatContact } from '../format'
import { usePoll } from '../use-poll'

const { data, error, loading } = usePoll<ClusterReport>(() => '/api/cluster')

const storageRatio = computed(() => {
	const used = data.value?.storageBytes
	const max = data.value?.storageMaxBytes
	if (used === null || used === undefined || max === null || max === undefined || max <= 0) return 0
	return Math.min(1, used / max)
})
</script>

<template>
	<section>
		<header class="mb-5 max-w-3xl">
			<h1 class="text-xl text-heading">cluster</h1>
			<p class="mt-1 text-sm text-muted/80">
				<span v-if="data?.leader">Leader {{ data.leader }}.</span>
				Each node is whatever answered the monitor. JetStream totals are the cluster, not a sum of pods.
			</p>
		</header>
		<p v-if="loading" class="font-mono text-sm text-muted/70">reading…</p>
		<p v-else-if="error" class="font-mono text-sm text-warning">{{ error }}</p>
		<template v-else-if="data">
			<p v-if="data.error" class="mb-3 font-mono text-sm text-warning">{{ data.error }}</p>
			<div class="mb-6 max-w-md">
				<div class="mb-1 flex justify-between font-mono text-xs text-muted/80">
					<span>jetstream storage</span>
					<span>{{ formatBytes(data.storageBytes) }} / {{ formatBytes(data.storageMaxBytes) }}</span>
				</div>
				<div class="h-1 bg-border">
					<div class="h-1 bg-heading" :style="{ width: `${storageRatio * 100}%` }"></div>
				</div>
				<p class="mt-2 font-mono text-xs text-muted/70">
					memory {{ formatBytes(data.memoryBytes) }} / {{ formatBytes(data.memoryMaxBytes) }} · streams
					{{ data.streams ?? '—' }} · consumers {{ data.consumers ?? '—' }} · meta pending
					{{ data.metaPending ?? '—' }}
				</p>
			</div>
			<div class="grid grid-cols-1 gap-px bg-border md:grid-cols-3">
				<article v-for="node in data.nodes" :key="node.name" class="bg-canvas px-3 py-3">
					<div class="flex items-center gap-2">
						<span
							class="status-dot inline-block h-2 w-2"
							:class="!node.reachable ? 'bg-danger' : node.slowConsumers > 0 ? 'bg-warning' : 'bg-ok'"
						></span>
						<h2 class="font-mono text-sm text-heading">{{ node.name }}</h2>
						<span v-if="data.leader === node.name" class="font-mono text-xs text-link">leader</span>
					</div>
					<p v-if="!node.reachable" class="mt-2 font-mono text-sm text-warning">unreachable</p>
					<dl v-else class="mt-3 grid grid-cols-[7rem_1fr] gap-y-1 font-mono text-xs">
						<dt class="text-muted/70">version</dt>
						<dd>{{ node.version ?? '—' }}</dd>
						<dt class="text-muted/70">uptime</dt>
						<dd>{{ node.uptime ?? '—' }}</dd>
						<dt class="text-muted/70">connections</dt>
						<dd>{{ node.connections }}</dd>
						<dt class="text-muted/70">slow</dt>
						<dd :class="node.slowConsumers > 0 ? 'text-warning' : ''">{{ node.slowConsumers }}</dd>
						<dt class="text-muted/70">stale</dt>
						<dd>{{ node.staleConnections }}</dd>
						<dt class="text-muted/70">subs</dt>
						<dd>{{ node.subscriptions }}</dd>
						<dt class="text-muted/70">routes</dt>
						<dd>{{ node.routes ?? '—' }}</dd>
						<dt class="text-muted/70">memory</dt>
						<dd>{{ formatBytes(node.memBytes) }}</dd>
					</dl>
				</article>
			</div>
			<h2 class="mt-8 mb-2 text-base text-heading">raft</h2>
			<p v-if="!data.replicas.length" class="font-mono text-sm text-muted">no replica list on this sample</p>
			<ul v-else class="font-mono text-sm">
				<li v-for="replica in data.replicas" :key="replica.name" class="flex gap-4 border-b border-border py-1">
					<span>{{ replica.name }}</span>
					<span :class="replica.current ? 'text-ok' : 'text-warning'">{{
						replica.current ? 'current' : 'behind'
					}}</span>
					<span class="text-muted/70">last contact {{ formatContact(replica.activeNs) }}</span>
				</li>
			</ul>
			<h2 class="mt-8 mb-2 text-base text-heading">consumers</h2>
			<p v-if="!data.consumerDetails.length" class="font-mono text-sm text-muted">no jetstream consumers</p>
			<div v-else class="overflow-x-auto">
				<table class="board">
					<thead>
						<tr>
							<th>stream</th>
							<th>consumer</th>
							<th>pending</th>
							<th>ack pending</th>
							<th>redelivered</th>
							<th>waiting</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="consumer in data.consumerDetails" :key="`${consumer.stream}/${consumer.name}`">
							<td>{{ consumer.stream }}</td>
							<td>{{ consumer.name }}</td>
							<td>{{ consumer.pending ?? '—' }}</td>
							<td :class="(consumer.ackPending ?? 0) > 0 ? 'text-warning' : ''">{{ consumer.ackPending ?? '—' }}</td>
							<td>{{ consumer.redelivered ?? '—' }}</td>
							<td>{{ consumer.waiting ?? '—' }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</template>
	</section>
</template>
