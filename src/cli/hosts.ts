import process from 'node:process'

/** Parsed infra/nixos/hosts.toml, keyed by friendly name. */
type Hosts = Record<string, { server: string; aliases?: string[] }>

/**
 * Find the friendly name for a friendly name or alias.
 * @param hosts - Parsed hosts.toml
 * @param input - Friendly name or alias
 * @returns Friendly name, or undefined when no host matches
 */
export const resolveHost = (hosts: Hosts, input: string): string | undefined =>
	Object.keys(hosts).find((name) => name === input || hosts[name]?.aliases?.includes(input))

// usage: bun ./src/cli/hosts.ts names | name <host> | server <host>
if (import.meta.main) {
	const hosts = Bun.TOML.parse(await Bun.file(new URL('../../infra/nixos/hosts.toml', import.meta.url)).text()) as Hosts
	const [command, input = ''] = process.argv.slice(2)
	const name = resolveHost(hosts, input)

	if (command === 'names') {
		console.log(Object.keys(hosts).join('\n'))
	} else if (name) {
		console.log(command === 'server' ? hosts[name]?.server : name)
	} else {
		console.error(`unknown host ${input} in infra/nixos/hosts.toml`)
		process.exit(1)
	}
}
