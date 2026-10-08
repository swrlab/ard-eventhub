import type { ArdFeed, ArdPublisher } from '#types'
import allowedLivestreamsJson from '../../config/allowed-livestreams.json' with { type: 'json' }
import { allowedLivestreamsConfig } from '../../schemas/config.ts'

const overlayConfig = allowedLivestreamsConfig.parse(allowedLivestreamsJson)

/** Why the overlay rows exist. Copied from `allowed-livestreams.json`. */
export const livestreamOverlayNote = overlayConfig.note

/** Publisher or institution as the catalog and later validation see them. */
type KnownLivestreamParty = {
	id: string
	title: string
}

/**
 * One livestream this process knows about.
 * Feed rows and `allowed-livestreams.json` share this shape.
 */
export type KnownLivestream = {
	/** Livestream URN publishers send. Feed rows use `externalId`, not the fusion `id`. */
	id: string
	title: string
	publisher: KnownLivestreamParty
	/** Null when an overlay publisher is not in the loaded feed. */
	institution: KnownLivestreamParty | null
	/** Granted by `allowed-livestreams.json`, not by a row in the core feed. */
	overlay: boolean
}

/** Publisher and institution the ownership check compares. */
export type LivestreamOwner = {
	publisherId: string
	institutionId: string
}

type PublisherFace = {
	title: string
	institution: KnownLivestreamParty | null
}

/**
 * Institution on a feed publisher. Title falls back to the acronym when the feed title is empty.
 * @param publisher - Feed publisher
 * @returns Institution, or null when the feed has no institution id
 */
const institutionOf = (publisher: ArdPublisher | undefined): KnownLivestreamParty | null => {
	const institution = publisher?.institution
	if (!institution?.id) return null
	return { id: institution.id, title: institution.title || institution.acronym || '' }
}

/**
 * Compare rows: core feed first, then institution, publisher, title.
 * @param a - Left row
 * @param b - Right row
 * @returns Sort order
 */
const byName = (a: KnownLivestream, b: KnownLivestream): number => {
	if (a.overlay !== b.overlay) return a.overlay ? 1 : -1
	const institution = (a.institution?.title ?? '').localeCompare(b.institution?.title ?? '')
	if (institution !== 0) return institution
	const publisher = a.publisher.title.localeCompare(b.publisher.title)
	if (publisher !== 0) return publisher
	return a.title.localeCompare(b.title)
}

/**
 * Feed plus overlay in one list.
 * A feed row's id is `externalId` (the livestream URN). The fusion `id` is ignored.
 * Overlay topics already present under that URN stay feed rows.
 * An overlay publisher copies its title and institution from the first feed item with the same publisher id.
 * @param feed - Snapshot in memory, or null when none is loaded
 * @returns Combined livestreams
 */
export const knownLivestreams = (feed: ArdFeed | null): KnownLivestream[] => {
	const entries: KnownLivestream[] = []
	const seen = new Set<string>()
	const publishers = new Map<string, PublisherFace>()

	for (const item of feed?.items ?? []) {
		const publisherId = item.publisher?.id
		if (publisherId && !publishers.has(publisherId)) {
			publishers.set(publisherId, {
				title: item.publisher.title || '',
				institution: institutionOf(item.publisher),
			})
		}
		const id = item.externalId
		if (!id || !publisherId || seen.has(id)) continue
		seen.add(id)
		entries.push({
			id,
			title: item.title || item.publisher.title || id,
			publisher: { id: publisherId, title: item.publisher.title || '' },
			institution: institutionOf(item.publisher),
			overlay: false,
		})
	}

	for (const extra of overlayConfig.livestreams) {
		if (seen.has(extra.id)) continue
		const face = publishers.get(extra.publisherId)
		entries.push({
			id: extra.id,
			title: extra.name,
			publisher: { id: extra.publisherId, title: face?.title ?? '' },
			institution: face?.institution ?? null,
			overlay: true,
		})
	}

	entries.sort(byName)
	return entries
}

let indexedFeed: ArdFeed | null = null
let indexedOwners = new Map<string, LivestreamOwner>()

/**
 * Livestream URN to publisher and institution, including the overlay.
 * Rows with no institution are left out. The same feed object keeps the map built on the previous call.
 * @param feed - Serving snapshot, or null when none is loaded
 * @returns Owners, or null when no feed is loaded
 */
export const livestreamOwners = (feed: ArdFeed | null): Map<string, LivestreamOwner> | null => {
	if (!feed) return null
	if (feed === indexedFeed) return indexedOwners
	const next = new Map<string, LivestreamOwner>()
	for (const row of knownLivestreams(feed)) {
		if (!row.institution?.id || !row.publisher.id) continue
		next.set(row.id, { publisherId: row.publisher.id, institutionId: row.institution.id })
	}
	indexedFeed = feed
	indexedOwners = next
	return next
}
