/**
 * @fileoverview Time inbox validation. Hyperfine wraps this process; the loop is the measured work.
 */

import process from 'node:process'
import { serveTestFeed } from '../connect/feed/test-feed.ts'
import { planInboxMessage } from '../connect/validation/plan.ts'

/** Cases hyperfine varies. `accept` is the reference. */
export const VALIDATION_BENCH_CASES = ['accept', 'schema', 'ownership'] as const

/** One hyperfine sample. Large enough that planning dominates Bun startup. */
const ITERATIONS = 20_000

const INSTITUTION = 'urn:ard:institution:a3004ff924ece1a2'
const LIVESTREAM = 'urn:ard:permanent-livestream:49267f7d67be180d'
const PUBLISHER = 'urn:ard:publisher:75dbb3dace15f610'
const SUBJECT = `inbox.${INSTITUTION}`
const NOW = '2026-10-08T12:00:00.000Z'

const track = {
	event: 'de.ard.eventhub.v1.radio.track.playing',
	type: 'music',
	start: '2026-10-08T12:00:00+02:00',
	length: 180,
	title: 'Song',
	playlistItemId: 'item-1',
	services: [{ id: LIVESTREAM, publisherId: PUBLISHER, institutionId: INSTITUTION }],
	creator: 'example@swr.de',
}

/** Which payload to plan. */
export type ValidationBenchCase = (typeof VALIDATION_BENCH_CASES)[number]

/**
 * Whether a CLI argument names a bench case.
 * @param value - argv token
 * @returns True when `value` is a {@link ValidationBenchCase}
 */
const isBenchCase = (value: string | undefined): value is ValidationBenchCase =>
	VALIDATION_BENCH_CASES.some((benchCase) => benchCase === value)

/**
 * JSON body for one case. Encoded once; the loop plans the same bytes.
 * @param benchCase - Which payload to plan
 * @returns Body `JSON.stringify` can encode
 */
const payloadFor = (benchCase: ValidationBenchCase): unknown => {
	if (benchCase === 'schema') return { ...track, title: undefined }
	if (benchCase === 'ownership') {
		return {
			...track,
			services: [
				{
					id: 'urn:ard:permanent-livestream:0000000000000000',
					publisherId: PUBLISHER,
					institutionId: INSTITUTION,
				},
			],
		}
	}
	return track
}

/**
 * Plan one case `iterations` times against a one-row test feed.
 * @param benchCase - Which payload to plan
 * @param iterations - Loop count
 * @returns Action seen on every iteration
 */
export const runValidationBench = (benchCase: ValidationBenchCase, iterations: number): 'ack' | 'term' => {
	const expected = benchCase === 'accept' ? 'ack' : 'term'
	const bytes = new TextEncoder().encode(JSON.stringify(payloadFor(benchCase)))
	const restore = serveTestFeed({ [LIVESTREAM]: { publisherId: PUBLISHER, institutionId: INSTITUTION } })
	try {
		for (let i = 0; i < iterations; i++) {
			const plan = planInboxMessage({ subject: SUBJECT, bytes, now: NOW })
			if (plan.action !== expected) {
				throw new Error(`${benchCase}: expected ${expected}, got ${plan.action}`)
			}
			if (plan.action === 'term' && plan.cause !== benchCase) {
				throw new Error(`${benchCase}: expected cause ${benchCase}, got ${plan.cause}`)
			}
		}
		return expected
	} finally {
		restore()
	}
}

if (import.meta.main) {
	const benchCase = process.argv[2]
	if (!isBenchCase(benchCase)) {
		console.error(`usage: bun ./src/cli/bench-validation.ts <${VALIDATION_BENCH_CASES.join('|')}>`)
		process.exit(1)
	}
	const seen = runValidationBench(benchCase, ITERATIONS)
	console.log(`${benchCase} ${ITERATIONS} ${seen}`)
}
