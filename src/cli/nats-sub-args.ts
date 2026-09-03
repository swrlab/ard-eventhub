import { inboxSubject } from '../utils/nats/subjects.ts'

export const NATS_SUB_USAGE = 'usage: bun run ./src/cli/nats-sub.ts <institutionId> | --all|-a'

/** Subscribe to one institution inbox, or every inbox on NATS. */
export type NatsSubTarget =
	| { kind: 'all'; subject: 'inbox.>' }
	| { kind: 'institution'; institutionId: string; subject: string }

/**
 * Parse nats-sub argv into a subscribe target.
 * @param argv - Args after the script path (`process.argv.slice(2)`)
 * @returns Institution subject or `inbox.>`
 * @throws {Error} When flags conflict, help is requested, or the target is missing
 */
export const parseNatsSubArgs = (argv: string[]): NatsSubTarget => {
	const flags = argv.filter((arg) => arg.startsWith('-'))
	const positionals = argv.filter((arg) => !arg.startsWith('-'))
	const wantsAll = flags.includes('--all') || flags.includes('-a')
	const wantsHelp = flags.includes('--help') || flags.includes('-h')
	const unknown = flags.filter((flag) => !['--all', '-a', '--help', '-h'].includes(flag))

	if (wantsHelp) {
		throw new Error(NATS_SUB_USAGE)
	}

	if (unknown.length > 0) {
		throw new Error(`${NATS_SUB_USAGE}\nunknown flag: ${unknown.join(', ')}`)
	}

	if (wantsAll && positionals.length > 0) {
		throw new Error(`${NATS_SUB_USAGE}\n--all cannot be combined with an institution id`)
	}

	if (wantsAll) {
		return { kind: 'all', subject: 'inbox.>' }
	}

	const institutionId = positionals[0]
	if (!institutionId || positionals.length !== 1) {
		throw new Error(NATS_SUB_USAGE)
	}

	return {
		kind: 'institution',
		institutionId,
		subject: inboxSubject(institutionId),
	}
}
