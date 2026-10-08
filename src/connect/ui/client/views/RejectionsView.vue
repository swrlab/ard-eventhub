<script setup lang="ts">
import type { RejectionsReport } from '../../types.ts'
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

const deprecated = computed(() => {
	const found = new Set<string>()
	for (const row of data.value?.rejections ?? []) {
		for (const field of row.deprecated) found.add(field)
	}
	return [...found]
})

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
				Recent feedback, full zod text. Filter to one institution and the URL keeps the filter.
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
							<th>cause</th>
							<th>message</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="(row, index) in data.rejections" :key="`${row.at}-${index}`">
							<td class="whitespace-nowrap">{{ formatClock(row.at) }}</td>
							<td class="max-w-xs break-all">{{ row.institutionId ?? '—' }}</td>
							<td>{{ row.cause ?? '—' }}</td>
							<td class="max-w-xl break-all">
								<p>{{ row.message }}</p>
								<p v-if="row.disagreed.length" class="text-warning">disagreed {{ row.disagreed.join(', ') }}</p>
								<p v-if="row.playlistItemId" class="text-muted/70">{{ row.playlistItemId }}</p>
								<p v-if="row.subject" class="text-muted/70">{{ row.subject }}</p>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			<h2 class="mt-8 mb-2 text-base text-heading">deprecated fields</h2>
			<p v-if="!deprecated.length" class="font-mono text-sm text-muted">
				no deprecated-field report in this window
			</p>
			<ul v-else class="font-mono text-sm">
				<li v-for="field in deprecated" :key="field">{{ field }}</li>
			</ul>
		</template>
	</section>
</template>
