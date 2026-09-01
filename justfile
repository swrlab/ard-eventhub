import 'just/encryption.just'

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

# run hurl integration tests against a host (default: local ingest)
[group('LOCAL')]
integration host="http://localhost:8080":
	just env "just integration-with-env {{host}}"

# run hurl suite (envs need to be provided: TEST_USER, TEST_USER_PW)
integration-with-env host:
	#!/usr/bin/env bash
	set -euo pipefail
	: "${TEST_USER:?TEST_USER is required}"
	: "${TEST_USER_PW:?TEST_USER_PW is required}"
	mkdir -p integration/res
	start="$(bun -e 'console.log(new Date().toISOString())')"
	start_expired="$(bun -e 'console.log(new Date(Date.now() - 20 * 60 * 1000).toISOString())')"
	start_invalid="${start}00"
	hurl \
		--variable host="{{host}}" \
		--variable email="$TEST_USER" \
		--variable password="$TEST_USER_PW" \
		--variable start="$start" \
		--variable start_expired="$start_expired" \
		--variable start_invalid="$start_invalid" \
		--test \
		integration/ingest-api.hurl

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
dev:
	just env "bun run ingest"

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

# regenerate openapi.json from Zod schemas
[group('LOCAL')]
openapi: asyncapi
	bun run ./src/openapi/generate.ts
	bun x oxfmt openapi.json

# regenerate asyncapi.json from Zod schemas (Eventhub Connect / MQTT)
[group('LOCAL')]
asyncapi:
	bun run ./src/asyncapi/generate.ts
	bun x oxfmt asyncapi.json

# serve the documentation (dev server with hot reload)
[group('LOCAL')]
docs: openapi
	bun x blume dev

# build the documentation to dist/
[group('LOCAL')]
docs-build: openapi
	bun x blume build

# preview the built documentation
[group('LOCAL')]
docs-preview:
	bun x blume preview

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

# deploy kubernetes secret to current cluster
[group('KUBERNETES')]
apply-k8s-secrets:
	sops decrypt keys/k8s-secrets.sops.yaml | kubectl apply -f -
