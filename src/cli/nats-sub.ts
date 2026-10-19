import process from 'node:process'
import { DEFAULT_NATS_URL, natsPassword, natsUrl, natsUser } from '../connect/env.ts'
import { natsAccess } from '../utils/nats/_client.ts'
import { NATS_SUB_USAGE, parseNatsSubArgs } from './nats-sub-args.ts'

const argv = process.argv.slice(2)
if (argv.includes('--help') || argv.includes('-h')) {
	console.error(NATS_SUB_USAGE)
	process.exit(0)
}

let target: ReturnType<typeof parseNatsSubArgs>
try {
	target = parseNatsSubArgs(argv)
} catch (error) {
	console.error(error instanceof Error ? error.message : error)
	process.exit(1)
}

const servers = natsUrl || DEFAULT_NATS_URL
const { subject } = target
const printSubject = target.kind === 'all'

const nc = await natsAccess.connect({
	servers,
	...(natsUser ? { user: natsUser } : {}),
	...(natsPassword ? { password: natsPassword } : {}),
})

const sub = nc.subscribe(subject)
console.error(`subscribed ${subject} on ${servers}`)

for await (const msg of sub) {
	if (printSubject) {
		console.log(msg.subject)
	}
	console.log(msg.string())
}
