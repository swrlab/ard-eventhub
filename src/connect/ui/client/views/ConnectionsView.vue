<script setup lang="ts">
import type { ConnectionsReport, UserRow } from '#types'
import { computed } from 'vue'
import { inject, ref, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatAge } from '../format'
import { usePoll } from '../use-poll'

const now = inject<Ref<number>>('now', ref(Date.now()))
const route = useRoute()
const router = useRouter()
const { data, error, loading } = usePoll<ConnectionsReport>(() => '/api/connections')

const selected = computed(() => (typeof route.query.user === 'string' ? route.query.user : ''))

const connections = computed(() => {
	const rows = data.value?.connections ?? []
	if (!selected.value) return rows
	return rows.filter((row) => row.user === selected.value)
})

const permitted = (user: UserRow): string => {
	if (user.institutions.length > 0) return user.institutions.join(' ')
	if (user.allows.length > 0) return user.allows.join(' ')
	return '—'
}

const toggleUser = (username: string): void => {
	const query = selected.value === username ? {} : { user: username }
	void router.replace({ query })
}
</script>

<template>
	<section>
		<header class="mb-5 max-w-3xl">
			<h1 class="text-xl text-heading">connections</h1>
			<p class="mt-1 text-sm text-muted/80">
				Die ältesten Zugänge stehen zuerst. Wer gerade nicht verbunden ist, kann entfernt werden. Passwörter stehen hier
				nicht.
			</p>
		</header>
		<p v-if="loading" class="font-mono text-sm text-muted/70">reading…</p>
		<p v-else-if="error" class="font-mono text-sm text-warning">{{ error }}</p>
		<template v-else-if="data">
			<p v-if="data.error" class="mb-3 font-mono text-sm text-warning">{{ data.error }}</p>
			<p v-if="data.note" class="mb-3 font-mono text-sm text-warning">{{ data.note }}</p>
			<div class="overflow-x-auto">
				<table class="board">
					<thead>
						<tr>
							<th>user</th>
							<th>issued</th>
							<th>connections</th>
							<th>type</th>
							<th>permitted</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="user in data.users" :key="user.username">
							<td>
								<button
									type="button"
									class="cursor-pointer border-0 bg-transparent p-0 text-left font-mono text-[0.8rem]"
									:class="selected === user.username ? 'text-link' : ''"
									@click="toggleUser(user.username)"
								>
									{{ user.username }}
								</button>
							</td>
							<td>{{ user.issued ?? '—' }}</td>
							<td :class="user.connections === 0 ? 'text-muted/60' : ''">{{ user.connections }}</td>
							<td>{{ user.connectionTypes.length ? user.connectionTypes.join(' ') : 'any' }}</td>
							<td class="max-w-md break-all">{{ permitted(user) }}</td>
						</tr>
					</tbody>
				</table>
			</div>
			<h2 class="mt-8 mb-3 text-base text-heading">live sockets{{ selected ? ` · ${selected}` : '' }}</h2>
			<p v-if="!connections.length" class="font-mono text-sm text-muted">no clients connected</p>
			<div v-else class="overflow-x-auto">
				<table class="board">
					<thead>
						<tr>
							<th>user</th>
							<th>type</th>
							<th>server</th>
							<th>address</th>
							<th>since</th>
							<th>last activity</th>
							<th>client</th>
							<th>subscriptions</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="row in connections" :key="`${row.server}-${row.cid}`">
							<td>{{ row.user || '—' }}</td>
							<td>{{ row.type ?? '—' }}</td>
							<td>{{ row.server }}</td>
							<td>{{ row.ip || '—' }}</td>
							<td>{{ formatAge(row.connectedAt, now) }}</td>
							<td>{{ formatAge(row.lastActivity, now) }}</td>
							<td>{{ row.mqttClient || row.name || '—' }}</td>
							<td class="max-w-md break-all">{{ row.subscriptions.length ? row.subscriptions.join(' ') : '—' }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</template>
	</section>
</template>
