<script setup lang="ts">
import type { RejectionsReport } from '#types'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatClock } from '../format'
import { usePoll } from '../use-poll'

const route = useRoute()
const router = useRouter()
const institution = computed(() => (typeof route.query.institution === 'string' ? route.query.institution : ''))
const draft = ref(institution.value)

watch(institution, (value) => {
	draft.value = value
})

const { data, error, loading } = usePoll<RejectionsReport>(() => {
	const value = institution.value.trim()
	return value ? `/api/rejections?institution=${encodeURIComponent(value)}` : '/api/rejections'
})

/**
 * Event as the board shows it. Text events (not JSON) stay as they arrived.
 * @param event - Rejected inbox event
 * @returns Indented JSON, or the text
 */
const pretty = (event: unknown): string => (typeof event === 'string' ? event : JSON.stringify(event, null, 2))

const apply = (): void => {
	const value = draft.value.trim()
	void router.replace(value ? { query: { institution: value } } : { query: {} })
}

const clearFilter = (): void => {
	draft.value = ''
	apply()
}
</script>

<template>
	<section>
		<header class="mb-5 max-w-3xl">
			<h1 class="text-xl text-heading">rejections</h1>
			<p class="mt-1 text-sm text-muted/80">
				Hier stehen die letzten abgelehnten Meldungen, pro Fehler eine Zeile. Der Filter bleibt beim Neuladen erhalten.
			</p>
		</header>
		<form class="mb-5 flex flex-wrap items-end gap-3" @submit.prevent="apply">
			<label class="flex flex-col gap-1 text-sm text-muted/80">
				institution
				<input v-model="draft" class="field w-80 max-w-full" placeholder="urn:ard:institution:…" spellcheck="false" />
			</label>
			<button type="submit" class="press">filter</button>
			<button v-if="institution" type="button" class="press" @click="clearFilter">clear</button>
		</form>
		<p v-if="loading" class="font-mono text-sm text-muted/70">reading…</p>
		<p v-else-if="error" class="font-mono text-sm text-warning">{{ error }}</p>
		<template v-else-if="data">
			<p v-if="data.error" class="mb-3 font-mono text-sm text-warning">{{ data.error }}</p>
			<p v-if="!data.rejections.length && !data.error" class="font-mono text-sm text-muted">
				{{ data.note ?? 'no rejection on feedback.>' }}
			</p>
			<div v-else class="overflow-x-auto">
				<table class="board">
					<thead>
						<tr>
							<th>time</th>
							<th>institution</th>
							<th>errors</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="row in data.rejections"
							:key="`${row.created}|${row.subject ?? ''}|${JSON.stringify(row.errors)}`"
						>
							<td class="whitespace-nowrap">{{ formatClock(row.created) }}</td>
							<td class="max-w-xs break-all">{{ row.institutionId ?? '—' }}</td>
							<td class="max-w-xl break-all">
								<p v-if="!row.errors.length">—</p>
								<p v-for="item in row.errors" :key="`${item.path}|${item.message}`">
									<span class="text-warning">{{ item.path }}</span> {{ item.message }}
									<span class="text-muted/60">{{ item.errorCode }}</span>
								</p>
								<p v-if="row.playlistItemId" class="text-muted/70">{{ row.playlistItemId }}</p>
								<p v-if="row.subject" class="text-muted/70">{{ row.subject }}</p>
								<details v-if="row.event !== null" class="mt-2">
									<summary class="cursor-pointer text-link">event json</summary>
									<pre class="mt-2 overflow-x-auto font-mono text-xs leading-5 break-normal whitespace-pre text-text">{{
										pretty(row.event)
									}}</pre>
								</details>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</template>
	</section>
</template>
