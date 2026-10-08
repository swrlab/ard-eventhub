import { test } from '@cross/test'
import { assertEquals } from '@std/assert'
import { knownLivestreams, livestreamOverlayNote } from '../../utils/known-livestreams.ts'
import { buildFeedCatalog } from './feed-catalog.ts'

test('buildFeedCatalog is the shared livestream list plus the overlay note', () => {
	const catalog = buildFeedCatalog(null)
	assertEquals(catalog.entries, knownLivestreams(null))
	assertEquals(catalog.note, livestreamOverlayNote)
	assertEquals(catalog.note.length > 0, true)
})
