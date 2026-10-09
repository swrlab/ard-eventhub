import type { KnownLivestream, OnAirStation } from '#types'

/** Publisher or institution the caller asked for. Empty strings are treated as omitted. */
export type OnAirSelector = {
	publisher: string | null
	institution: string | null
}

/**
 * One livestream, with the on-air board fields plus the feed title and publisher URN.
 * A station the feed lists and that has nothing retained keeps null track fields.
 */
export type OnAirMatch = OnAirStation & {
	title: string | null
	publisherId: string | null
}

/** What `on-air` returns before the tool adds the query echo. */
export type OnAirLookupReport = {
	at: string
	error: string | null
	note: string | null
	truncated: boolean
	stations: OnAirMatch[]
}

/** Stations that match a selector, plus a note when the list is empty or quiet. */
export type OnAirSelection = {
	note: string | null
	stations: OnAirMatch[]
}

/**
 * Trim a query. Blank becomes null so an omitted field and an empty string match the same way.
 * @param value - Raw argument
 * @returns Trimmed text, or null
 */
const queryText = (value: string | null): string | null => {
	const trimmed = value?.trim() ?? ''
	return trimmed.length > 0 ? trimmed : null
}

/**
 * Compare titles without caring about case. German casing so `ß` and umlauts fold.
 * @param value - Title or id
 * @returns Folded text
 */
const fold = (value: string): string => value.toLocaleLowerCase('de-DE')

/**
 * Whether one publisher or institution query hits this id or title.
 * An exact id or title matches. A title fragment matches when the query is not itself an id.
 * A null query does not constrain this side.
 * @param query - URN or title, or null when this side was omitted
 * @param id - Party URN, or null
 * @param title - Party title, or null
 * @returns True when this side matches
 */
const partyHit = (query: string | null, id: string | null, title: string | null): boolean => {
	if (!query) return true
	if (id === query) return true
	const needle = fold(query)
	if (id && fold(id) === needle) return true
	if (title && fold(title) === needle) return true
	if (query.includes(':') || query.length < 2) return false
	return Boolean(title && fold(title).includes(needle))
}

/**
 * Whether a feed row is the publisher and institution asked for.
 * @param entry - Catalog row
 * @param publisher - Publisher query, or null
 * @param institution - Institution query, or null
 * @returns True when both sides match
 */
const catalogHit = (entry: KnownLivestream, publisher: string | null, institution: string | null): boolean =>
	partyHit(publisher, entry.publisher.id, entry.publisher.title || null) &&
	partyHit(institution, entry.institution?.id ?? null, entry.institution?.title || null)

/**
 * A catalog row with no retained radio subject yet.
 * @param entry - Feed or overlay row
 * @returns An empty on-air match
 */
const quietStation = (entry: KnownLivestream): OnAirMatch => ({
	livestreamId: entry.id,
	title: entry.title || null,
	publisherId: entry.publisher.id || null,
	institutionId: entry.institution?.id ?? null,
	institutionTitle: entry.institution?.title || null,
	publisherTitle: entry.publisher.title || null,
	lastEventAt: null,
	playing: null,
	next: null,
	control: null,
	data: null,
})

/**
 * Newest retained event first. Stations with nothing retained follow, by livestream id.
 * @param left - One match
 * @param right - The other match
 * @returns Sort order
 */
const byLatest = (left: OnAirMatch, right: OnAirMatch): number => {
	if (left.lastEventAt === null && right.lastEventAt === null)
		return left.livestreamId.localeCompare(right.livestreamId)
	if (left.lastEventAt === null) return 1
	if (right.lastEventAt === null) return -1
	const time = right.lastEventAt.localeCompare(left.lastEventAt)
	if (time !== 0) return time
	return left.livestreamId.localeCompare(right.livestreamId)
}

/**
 * Keep the livestreams that belong to the publisher, the institution, or both.
 * A feed row with no retained subject is still returned, with empty track fields.
 * Both sides set means both must match. Both omitted returns nothing.
 * @param stations - On-air rows, already named from the feed
 * @param catalog - Feed plus overlay
 * @param selector - Publisher and institution queries
 * @returns Matches and a note when none are live
 */
export const selectOnAir = (
	stations: readonly OnAirStation[],
	catalog: readonly KnownLivestream[],
	selector: OnAirSelector
): OnAirSelection => {
	const publisher = queryText(selector.publisher)
	const institution = queryText(selector.institution)
	if (!publisher && !institution) {
		return { note: 'publisher or institution is required', stations: [] }
	}

	const byId = new Map(catalog.map((entry) => [entry.id, entry]))
	const seen = new Set<string>()
	const matches: OnAirMatch[] = []

	for (const station of stations) {
		const entry = byId.get(station.livestreamId)
		const publisherId = entry?.publisher.id ?? station.playing?.publisherId ?? station.next?.publisherId ?? null
		const publisherTitle = station.publisherTitle ?? (entry?.publisher.title || null)
		const institutionId = station.institutionId ?? entry?.institution?.id ?? null
		const institutionTitle = station.institutionTitle ?? (entry?.institution?.title || null)
		const hit = entry
			? catalogHit(entry, publisher, institution)
			: partyHit(publisher, publisherId, publisherTitle) && partyHit(institution, institutionId, institutionTitle)
		if (!hit) continue
		seen.add(station.livestreamId)
		matches.push({
			...station,
			title: entry?.title || null,
			publisherId,
			institutionId,
			institutionTitle,
			publisherTitle,
		})
	}

	for (const entry of catalog) {
		if (seen.has(entry.id) || !catalogHit(entry, publisher, institution)) continue
		matches.push(quietStation(entry))
	}

	matches.sort(byLatest)
	if (matches.length === 0) return { note: 'no livestream for this publisher or institution', stations: matches }
	if (matches.every((station) => station.lastEventAt === null)) {
		return { note: 'nothing retained for this publisher or institution', stations: matches }
	}
	return { note: null, stations: matches }
}
