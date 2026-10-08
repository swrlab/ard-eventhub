import { computed, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'

const POLL_MS = 8_000

/**
 * Poll a JSON endpoint. Hidden tabs skip a tick and refresh when shown again.
 * This is the stats path. It does not open the live-tail socket.
 * @param path - URL getter so a query change refetches
 * @returns The latest body, a transport error, and a first-load flag
 */
export const usePoll = <T>(
	path: () => string
): {
	data: Ref<T | null>
	error: Ref<string | null>
	loading: Ref<boolean>
} => {
	const data: Ref<T | null> = ref(null)
	const error = ref<string | null>(null)
	const loading = ref(true)
	const current = computed(path)
	let timer: ReturnType<typeof setInterval> | null = null

	const tick = async (): Promise<void> => {
		if (document.hidden) return
		try {
			const response = await fetch(current.value)
			if (!response.ok) {
				error.value = `${response.status}`
				return
			}
			data.value = (await response.json()) as T
			error.value = null
		} catch (caught) {
			error.value = caught instanceof Error ? caught.message : 'request failed'
		} finally {
			loading.value = false
		}
	}

	const onVisible = (): void => {
		if (!document.hidden) void tick()
	}

	onMounted(() => {
		void tick()
		timer = setInterval(() => {
			void tick()
		}, POLL_MS)
		document.addEventListener('visibilitychange', onVisible)
	})

	onUnmounted(() => {
		if (timer) clearInterval(timer)
		document.removeEventListener('visibilitychange', onVisible)
	})

	watch(current, () => {
		void tick()
	})

	return { data, error, loading }
}
