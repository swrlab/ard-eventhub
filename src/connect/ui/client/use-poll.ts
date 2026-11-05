import { computed, onMounted, onUnmounted, ref, watch, type Ref } from 'vue'

export const POLL_MS = 8_000

/** Whether the tab is hidden. False outside a browser (e.g. unit tests), never skipping a tick there. */
const isDocumentHidden = (): boolean => typeof document !== 'undefined' && document.hidden

/**
 * Guarded poller: fetch, and only commit a response while it is still the latest request.
 * Exported standalone (no lifecycle hooks) so the race guard is unit-testable without mounting a component.
 * @param path - URL getter so a query change refetches
 * @returns The latest body, a transport error, a first-load flag, and the tick to call on an interval or event
 */
export const createPoller = <T>(
	path: () => string
): {
	data: Ref<T | null>
	error: Ref<string | null>
	loading: Ref<boolean>
	tick: () => Promise<void>
} => {
	const data: Ref<T | null> = ref(null)
	const error = ref<string | null>(null)
	const loading = ref(true)
	const current = computed(path)
	// Bumped on every tick. A response only commits when it is still the latest request,
	// so an overlapping tick or a path change mid-flight cannot overwrite a newer result.
	let generation = 0

	const tick = async (): Promise<void> => {
		if (isDocumentHidden()) return
		const requestId = ++generation
		try {
			const response = await fetch(current.value)
			if (requestId !== generation) return
			if (!response.ok) {
				error.value = `${response.status}`
				return
			}
			const body = (await response.json()) as T
			if (requestId !== generation) return
			data.value = body
			error.value = null
		} catch (caught) {
			if (requestId !== generation) return
			error.value = caught instanceof Error ? caught.message : 'request failed'
		} finally {
			if (requestId === generation) loading.value = false
		}
	}

	return { data, error, loading, tick }
}

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
	const { data, error, loading, tick } = createPoller<T>(path)
	const current = computed(path)
	let timer: ReturnType<typeof setInterval> | null = null

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
