<script setup lang="ts">
import type { OnAirReport } from '#types'
import { inject, ref, type Ref } from 'vue'
import { ageTone, formatAge, formatRemain } from '../format'
import { usePoll } from '../use-poll'

const now = inject<Ref<number>>('now', ref(Date.now()))
const { data, error, loading } = usePoll<OnAirReport>(() => '/api/on-air')

const controlLine = (name: string | null, state: boolean | null, validUntil: string | null): string => {
	const flag = name ?? 'control'
	const bit = state === null ? '' : state ? ' on' : ' off'
	const remain = formatRemain(validUntil, now.value)
	return remain ? `${flag}${bit} · ${remain}` : `${flag}${bit}`
}
</script>

<template>
	<section>
		<header class="mb-5 max-w-3xl">
			<h1 class="text-xl text-heading">on-air</h1>
			<p class="mt-1 text-sm text-muted/80">
				Oben stehen die Sender, von denen am längsten nichts mehr kam. Die Liste aktualisiert sich von selbst.
			</p>
		</header>
		<p v-if="loading" class="font-mono text-sm text-muted/70">reading…</p>
		<p v-else-if="error" class="font-mono text-sm text-warning">{{ error }}</p>
		<p v-else-if="data?.error" class="font-mono text-sm text-warning">{{ data.error }}</p>
		<p v-else-if="!data?.stations.length" class="font-mono text-sm text-muted">
			{{ data?.note ?? 'no retained radio subject on this cluster' }}
		</p>
		<div v-else class="overflow-x-auto">
			<p v-if="data.truncated" class="mb-3 font-mono text-sm text-warning">subject list truncated at 200</p>
			<table class="board">
				<thead>
					<tr>
						<th>station</th>
						<th>last event</th>
						<th>track</th>
						<th>publisher</th>
						<th>control</th>
						<th>data</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="station in data.stations" :key="station.livestreamId">
						<td class="max-w-xs">
							<p class="break-all">{{ station.livestreamId }}</p>
							<p v-if="station.institutionTitle" class="mt-1">{{ station.institutionTitle }}</p>
							<p v-if="station.institutionId" class="mt-1 break-all text-muted/70">{{ station.institutionId }}</p>
						</td>
						<td class="max-w-xs">
							<p v-if="station.publisherTitle">{{ station.publisherTitle }}</p>
							<p class="break-all" :class="station.publisherTitle ? 'text-muted/70' : ''">
								{{ station.playing?.publisherId ?? '—' }}
							</p>
						</td>
						<td :class="ageTone(station.lastEventAt, now)">{{ formatAge(station.lastEventAt, now) }}</td>
						<td class="max-w-sm">
							<p>{{ station.playing?.title ?? '—' }}</p>
							<p v-if="station.playing?.artist" class="text-muted/80">{{ station.playing.artist }}</p>
							<p v-if="station.next?.title" class="text-muted/70">next · {{ station.next.title }}</p>
						</td>
						<td>
							{{
								station.control
									? controlLine(station.control.name, station.control.state, station.control.validUntil)
									: '—'
							}}
						</td>
						<td class="max-w-xs">
							<p class="line-clamp-2">{{ station.data?.text ?? '—' }}</p>
							<p v-if="station.data?.at" class="text-muted/70">{{ formatAge(station.data.at, now) }}</p>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>
</template>
