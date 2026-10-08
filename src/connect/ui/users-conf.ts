import type { UserRow } from './types.ts'
import type { LiveConnection } from './types.ts'

export type ConfiguredUser = {
	username: string
	issued: string | null
	institutions: string[]
	allows: string[]
	connectionTypes: string[]
}

const INSTITUTION_RE = /urn:ard:institution:[a-z0-9]+/g
const ISSUED_RE = /-(\d{4}-\d{2}-\d{2})$/

/**
 * Issue date encoded in an RFC §7.2 username, when the name ends with one.
 * @param username - NATS username
 * @returns `YYYY-MM-DD`, or null
 */
const issueDate = (username: string): string | null => ISSUED_RE.exec(username)?.[1] ?? null

/**
 * Quoted strings inside an allow clause.
 * @param section - Text of a publish or subscribe block
 * @returns Allow subjects. Deny lists are ignored.
 */
const allowSubjects = (section: string): string[] => {
	const allow = /allow:\s*(\[[\s\S]*?\]|"[^"]+")/.exec(section)
	const body = allow?.[1]
	if (!body) return []
	return [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? '').filter((entry) => entry.length > 0)
}

/**
 * Body of a `publish` or `subscribe` object. One-line and multi-line blocks both match.
 * @param block - One user block
 * @param key - `publish` or `subscribe`
 * @returns The object body, or an empty string
 */
const permissionBody = (block: string, key: string): string => {
	const inline = new RegExp(`${key}:\\s*\\{([^}]*)\\}`).exec(block)
	if (inline?.[1]?.includes('allow')) return inline[1]
	const multi = new RegExp(`${key}:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`).exec(block)
	return multi?.[1] ?? ''
}

/**
 * Institution URNs mentioned in allow subjects.
 * @param allows - Subject patterns
 * @returns Unique institution URNs, file order
 */
const institutionsIn = (allows: string[]): string[] => {
	const seen = new Set<string>()
	const found: string[] = []
	for (const allow of allows) {
		for (const match of allow.matchAll(INSTITUTION_RE)) {
			const urn = match[0]
			if (!urn || seen.has(urn)) continue
			seen.add(urn)
			found.push(urn)
		}
	}
	return found
}

/**
 * Connection types from `allowed_connection_types`, or an empty list when unset (any type).
 * @param block - One user block
 * @returns Type names
 */
const connectionTypes = (block: string): string[] => {
	const match = /allowed_connection_types:\s*\[([^\]]*)\]/.exec(block)
	const body = match?.[1]
	if (!body) return []
	return [...body.matchAll(/"([^"]+)"/g)].map((item) => item[1] ?? '').filter((entry) => entry.length > 0)
}

/**
 * Read configured users from a NATS config. Passwords and bcrypt hashes are not returned.
 * @param source - `nats-users.conf` text
 * @returns Users in file order
 */
export const parseUsersConf = (source: string): ConfiguredUser[] => {
	const users: ConfiguredUser[] = []
	const re = /user:\s*"([^"]+)"([\s\S]*?)(?=user:\s*"|$)/g
	for (const match of source.matchAll(re)) {
		const username = match[1]
		const block = match[2] ?? ''
		if (!username) continue
		const allows = [
			...allowSubjects(permissionBody(block, 'publish')),
			...allowSubjects(permissionBody(block, 'subscribe')),
		]
		users.push({
			username,
			issued: issueDate(username),
			institutions: institutionsIn(allows),
			allows,
			connectionTypes: connectionTypes(block),
		})
	}
	return users
}

/**
 * Join the user file with live connections. A connected name missing from the file is still listed.
 * Oldest issue date first. Passwords are not a field on either input.
 * @param configured - Users from the config file
 * @param live - Connections from the monitor
 * @returns Rows for the connections board
 */
export const buildUserRows = (configured: ConfiguredUser[], live: LiveConnection[]): UserRow[] => {
	const counts = new Map<string, number>()
	for (const connection of live) {
		if (!connection.user) continue
		counts.set(connection.user, (counts.get(connection.user) ?? 0) + 1)
	}
	const known = new Set(configured.map((user) => user.username))
	const rows: UserRow[] = configured.map((user) => ({
		username: user.username,
		issued: user.issued,
		institutions: user.institutions,
		allows: user.allows,
		connectionTypes: user.connectionTypes,
		connections: counts.get(user.username) ?? 0,
	}))
	for (const [username, connections] of counts) {
		if (known.has(username)) continue
		rows.push({
			username,
			issued: issueDate(username),
			institutions: [],
			allows: [],
			connectionTypes: [],
			connections,
		})
	}
	rows.sort((a, b) => {
		const issued = (a.issued ?? '9999').localeCompare(b.issued ?? '9999')
		if (issued !== 0) return issued
		return a.username.localeCompare(b.username)
	})
	return rows
}
