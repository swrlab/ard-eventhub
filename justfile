# run just in the CLI to see the list of shortcuts
_default:
	just --list

# run the ingest tests locally
test:
	bun run ingest:test:local

# generate a coreId for a given text
coreId text:
	bun run coreId "{{text}}"

# start the ingest service in development mode
dev:
	bun run ingest:local

# serve the documentation
docs:
	bun run docs:serve
