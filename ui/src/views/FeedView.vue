<script setup lang="ts">
import type { FeedCatalogReport, KnownLivestream } from '../../../src/connect/ui/types.ts'
import { computed, inject, ref, type Ref } from 'vue'
import { RouterLink } from 'vue-router'
import { formatAge } from '../format'
import { usePoll } from '../use-poll'

const now = inject<Ref<number>>('now', ref(Date.now()))
const query = ref('')
const { data, error, loading } = usePoll<FeedCatalogReport>(() => '/api/feed/catalog')

const rows = computed(() => {
	const entries = data.value?.entries ?? []
	const needle = query.value.trim().toLowerCase()
	if (!needle) return entries
	return entries.filter((entry) =>
		[
			entry.title,
			entry.id,
			entry.publisher.id,
			entry.publisher.title,
			entry.institution?.id,
			entry.institution?.title,
		].some((value) => value?.toLowerCase().includes(needle))
	)
})

const feedCount = computed(() => data.value?.entries.filter((entry) => !entry.overlay).length ?? 0)
const overlayCount = computed(() => data.value?.entries.filter((entry) => entry.overlay).length ?? 0)

/**
 * Station label. Publisher title when the feed has one, otherwise the publisher URN.
 * @param entry - Catalog row
 * @returns Label
 */
const publisherLabel = (entry: KnownLivestream): string => entry.publisher.title || entry.publisher.id

/**
 * Where the row came from.
 * @param entry - Catalog row
 * @returns `overlay` or `feed`
 */
const origin = (entry: KnownLivestream): string => (entry.overlay ? 'overlay' : 'feed')

/**
 * Tail for one livestream. The subject token is the livestream URN (`externalId` on a feed row).
 * @param entry - Catalog row
 * @returns Route to the live tail
 */
const tailTo = (entry: KnownLivestream): { name: string; query: { filter: string } } => ({
	name: 'tail',
	query: { filter: `radio.${entry.id}.>` },
})
</script>

<template>
	<section>
		<header class="mb-5 max-w-3xl">
			<h1 class="text-xl text-heading">feed</h1>
			<p class="mt-1 text-sm text-muted/80">
				The snapshot this process is authorizing with.
				<span v-if="data">
					{{ data.source ?? 'empty' }}
					<span v-if="data.revision !== null">· rev {{ data.revision }}</span>
					· {{ formatAge(data.generatedAt, now) }}
					<span v-if="data.staleness !== 'ok' && data.staleness !== 'never'">· {{ data.staleness }}</span>
				</span>
			</p>
			<p class="mt-2 text-sm text-muted/80">
				The livestream title opens its tail. The id is the feed <code>externalId</code>, the URN publishers send. Rows
				marked overlay are not in the ARD core feed. They come from <code>allowed-livestreams.json</code> and add a
				publish permission: the event's <code>publisherId</code> must match, and the institution is still that
				publisher's house in the feed.
			</p>
			<p v-if="data?.note" class="mt-2 text-sm text-muted/70">{{ data.note }}</p>
		</header>
		<p v-if="loading" class="font-mono text-sm text-muted/70">reading…</p>
		<p v-else-if="error" class="font-mono text-sm text-warning">{{ error }}</p>
		<template v-else-if="data">
			<p v-if="data.lastError" class="mb-3 font-mono text-sm text-warning">{{ data.lastError }}</p>
			<div class="mb-4 flex flex-wrap items-baseline gap-4">
				<input v-model="query" class="field w-80 max-w-full" placeholder="station, house, or urn" spellcheck="false" />
				<p class="font-mono text-xs text-muted">
					{{ feedCount }} feed · {{ overlayCount }} overlay · {{ rows.length }} shown
				</p>
			</div>
			<p v-if="!rows.length" class="font-mono text-sm text-muted">no match</p>
			<div v-else class="overflow-x-auto">
				<table class="board">
					<thead>
						<tr>
							<th>livestream</th>
							<th>publisher</th>
							<th>institution</th>
							<th>id</th>
							<th>from</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="entry in rows" :key="entry.id">
							<td>
								<RouterLink class="text-link" :to="tailTo(entry)">{{ entry.title }}</RouterLink>
							</td>
							<td :title="entry.publisher.id">{{ publisherLabel(entry) }}</td>
							<td :title="entry.institution?.id ?? ''">{{ entry.institution?.title || '—' }}</td>
							<td class="max-w-xs break-all font-mono text-xs text-muted">{{ entry.id }}</td>
							<td :class="entry.overlay ? 'text-warning' : 'text-muted'">{{ origin(entry) }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</template>
	</section>
</template>
