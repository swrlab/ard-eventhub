/**
 * Age of an ISO timestamp, worst stations read as a duration.
 * @param iso - Event time, or null
 * @param now - Current time in ms
 * @returns A short duration, or an em dash
 */
export const formatAge = (iso: string | null, now: number): string => {
	if (!iso) return '—'
	const then = Date.parse(iso)
	if (Number.isNaN(then)) return '—'
	const sec = Math.max(0, Math.floor((now - then) / 1000))
	return formatDuration(sec)
}

/**
 * Remaining time until an ISO timestamp. `lapsed` once it has passed.
 * @param iso - Deadline, or null
 * @param now - Current time in ms
 * @returns Remaining duration, `lapsed`, or null when there is no deadline
 */
export const formatRemain = (iso: string | null, now: number): string | null => {
	if (!iso) return null
	const then = Date.parse(iso)
	if (Number.isNaN(then)) return null
	const sec = Math.floor((then - now) / 1000)
	if (sec <= 0) return 'lapsed'
	return formatDuration(sec)
}

/**
 * Tone for how long a station has been quiet.
 * @param iso - Last event time
 * @param now - Current time in ms
 * @returns A text color class
 */
export const ageTone = (iso: string | null, now: number): string => {
	if (!iso) return 'text-warning'
	const sec = (now - Date.parse(iso)) / 1000
	if (sec > 30 * 60) return 'text-danger'
	if (sec > 5 * 60) return 'text-warning'
	return 'text-heading'
}

/**
 * Format a duration in seconds.
 * @param sec - Whole seconds
 * @returns `12s`, `3m 4s`, or `2h 1m`
 */
const formatDuration = (sec: number): string => {
	if (sec < 60) return `${sec}s`
	const min = Math.floor(sec / 60)
	if (min < 60) return `${min}m ${sec % 60}s`
	const hr = Math.floor(min / 60)
	return `${hr}h ${min % 60}m`
}

/**
 * Decimal byte size, matching NATS config values such as `1000000000`.
 * @param bytes - Byte count, or null
 * @returns A short size
 */
export const formatBytes = (bytes: number | null): string => {
	if (bytes === null) return '—'
	const units = ['B', 'KB', 'MB', 'GB', 'TB']
	let value = bytes
	let unit = 0
	while (value >= 1000 && unit < units.length - 1) {
		value /= 1000
		unit += 1
	}
	const shown = unit === 0 || value >= 10 ? value.toFixed(0) : value.toFixed(1)
	return `${shown} ${units[unit] ?? 'B'}`
}

/**
 * JetStream replica contact age. `active` on `/jsz` is nanoseconds.
 * @param ns - Nanoseconds since last contact, or null
 * @returns A short duration
 */
export const formatContact = (ns: number | null): string => {
	if (ns === null) return '—'
	const ms = ns / 1_000_000
	if (ms < 1000) return `${ms.toFixed(0)} ms`
	return `${(ms / 1000).toFixed(1)} s`
}

/**
 * Local date and clock for a feed stamp. Minutes, not a ticking duration.
 * @param iso - ISO timestamp, or null
 * @returns `8 Oct 14:17`, or an em dash
 */
export const formatStamp = (iso: string | null): string => {
	if (!iso) return '—'
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return '—'
	return date.toLocaleString(undefined, {
		day: 'numeric',
		month: 'short',
		hourCycle: 'h23',
		hour: '2-digit',
		minute: '2-digit',
	})
}

/**
 * Clock time for a tail frame.
 * @param iso - ISO timestamp
 * @returns Local 24-hour time
 */
export const formatClock = (iso: string): string => {
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return iso
	return date.toLocaleTimeString(undefined, {
		hourCycle: 'h23',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	})
}
