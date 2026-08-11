const HIDDEN = 'hidden'

/**
 * Whether a header name is sensitive and must not appear in logs.
 * @param key - Header name
 * @returns True when the value should be redacted
 */
const isSensitiveHeader = (key: string): boolean => {
	const lower = key.toLowerCase()
	return lower === 'authorization' || lower === 'x-authorization'
}

/**
 * Copy request headers for logging with auth credentials redacted.
 * @param headers - Fetch `Headers` or a plain header record
 * @returns Plain object safe to include in log `data`
 */
export const getSafeHeaders = (
	headers: Headers | Record<string, string | undefined | null>
): Record<string, string> => {
	const entries: Iterable<[string, string]> =
		headers instanceof Headers
			? headers
			: Object.entries(headers).filter((entry): entry is [string, string] => entry[1] != null)

	const result: Record<string, string> = {}
	for (const [key, value] of entries) {
		result[key] = isSensitiveHeader(key) ? HIDDEN : value
	}
	return result
}
