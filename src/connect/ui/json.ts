/**
 * Whether a value is a plain JSON object.
 * @param value - Candidate
 * @returns True for non-null non-array objects
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Read a non-empty string field.
 * @param record - Object, or null
 * @param key - Field name
 * @returns The string, or null
 */
export const stringField = (record: Record<string, unknown> | null, key: string): string | null => {
	if (!record) return null
	const value = record[key]
	return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Read a finite number field.
 * @param record - Object, or null
 * @param key - Field name
 * @returns The number, or null
 */
export const numberField = (record: Record<string, unknown> | null, key: string): number | null => {
	if (!record) return null
	const value = record[key]
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Read a boolean field.
 * @param record - Object, or null
 * @param key - Field name
 * @returns The boolean, or null
 */
export const booleanField = (record: Record<string, unknown> | null, key: string): boolean | null => {
	if (!record) return null
	const value = record[key]
	return typeof value === 'boolean' ? value : null
}

/**
 * Keep only string entries from an unknown list.
 * @param value - Candidate list
 * @returns String entries, or an empty list
 */
export const stringList = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

/**
 * Error text safe to show in the UI. No stack.
 * @param error - Thrown value
 * @returns Message string
 */
export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'request failed')
