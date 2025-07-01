# run just in the CLI to see the list of shortcuts
_default:
	just --list

test:
	bun run ingest:test:local
