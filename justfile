import 'just/docs.just'
import 'just/encryption.just'
import 'just/integration.just'
import 'just/mqtt.just'
import 'just/nats.just'

# run just in the CLI to see the list of shortcuts
_default:
	just --list

# install toolchain (mise) + package dependencies (aube) (pass --env ci if needed)
[group('DEV-SETUP')]
install *args:
	mise install {{ args }}  
	mise lock {{ args }}
	bun install --silent

# update package dependencies (pass --env ci if needed)
[group('DEV-SETUP')]
update *args:
	mise upgrade --bump -y --local {{ args }}
	mise outdated --quiet {{ args }}
	mise lock {{ args }}
	bun update
	just format

# run the ingest tests locally with injected environment variables
[group('LOCAL')]
test:
	just env "just test-with-env"

# run testing (envs need to be provided)
test-with-env:
	bun test --timeout 120000

# generate a coreId for a given text
[group('LOCAL')]
coreId text:
	bun run ./src/cli/core-id.ts "{{ text }}"

# download the ARD feed
[group('LOCAL')]
feed:
	bun run ./src/cli/feed.ts

# start the ingest service in development mode
[group('LOCAL')]
ingest:
	just env "bun run ingest"

# start eventhub-connect (NATS access + operator UI on :4173)
[group('LOCAL')]
dev:
	bun run --hot ./src/connect/index.ts

# lint the code
[group('LOCAL')]
lint:
	bun x oxlint
	bun x oxfmt --check
	bun x knip
	bun x tsc

# fix and format everything
[group('LOCAL')]
format:
	bun x oxlint --fix
	bun x oxfmt

# check dependency licenses
[group('LOCAL')]
license:
	bun x license-compliance -f json -r detailed

# print the radioplayer api keys in base64 format for kubernetes secret
[group('KUBERNETES')]
radioplayer-api-keys:
	@echo ""
	@echo "base64-wrapped once"
	@sops decrypt keys/radioplayer-api-keys.sops.json | base64
	@echo ""
	@echo "--------------"
	@echo ""
	@echo "base64-wrapped twice"
	@sops decrypt keys/radioplayer-api-keys.sops.json | base64 | base64
