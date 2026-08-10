import 'just/encryption.just'

# run just in the CLI to see the list of shortcuts
_default:
	just --list

## ---------------------------------

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
	just env "bun test --timeout 120000"

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

# lint and auto-fix
[group('LOCAL')]
lint-fix:
	bun x oxlint --fix

# format everything
[group('LOCAL')]
format:
	bun x oxfmt

# lint and format-check
[group('LOCAL')]
check:
	bun x oxlint
	bun x oxfmt --check

# check dependency licenses
[group('LOCAL')]
license:
	bun x license-compliance -f json -r detailed

# typecheck
[group('LOCAL')]
typecheck:
	bun x tsgo

# find unused files, exports, and dependencies
[group('LOCAL')]
knip:
	bun x knip

# run check, typecheck, and knip in parallel
[group('LOCAL')]
checks:
	#!/usr/bin/env bash
	set -euo pipefail
	just check &
	p1=$!
	just typecheck &
	p2=$!
	just knip &
	p3=$!
	status=0
	wait "$p1" || status=1
	wait "$p2" || status=1
	wait "$p3" || status=1
	exit "$status"

# regenerate openapi.json from Zod schemas
[group('LOCAL')]
openapi:
	bun run ./src/openapi/generate.ts
	bun x oxfmt openapi.json

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
