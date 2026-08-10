# run just in the CLI to see the list of shortcuts
_default:
	just --list

# use a default sops file, or allow to be overridden by SOPS_ENV_FILE environment variable
DEFAULT_SOPS_FILE := '.env.sops.yaml'
SELECTED_SOPS_FILE := env('SOPS_ENV_FILE', DEFAULT_SOPS_FILE)

# run a command with the selected sops file (injecting environment variables)
[group('ENCRYPTION')]
env *args:
	sops exec-env --same-process {{ SELECTED_SOPS_FILE }} "{{ args }}"

## ---------------------------------

# run the ingest tests locally with injected environment variables
[group('LOCAL')]
test:
	just env "bun run test"

# generate a coreId for a given text
[group('LOCAL')]
coreId text:
	bun run coreId "{{ text }}"

# download the ARD feed
[group('LOCAL')]
feed:
	bun run feed

# start the ingest service in development mode
[group('LOCAL')]
dev:
	just env "bun run ingest"

# lint the code
[group('LOCAL')]
lint:
	bun x oxlint

# format everything
[group('LOCAL')]
format:
	bun x oxfmt

# serve the documentation (dev server with hot reload)
[group('LOCAL')]
docs:
	bun run docs:dev

# build the documentation to dist/
[group('LOCAL')]
docs-build:
	bun run docs:build

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

## ---------------------------------
## ENCRYPTION shortcuts

_sops-files:
	#!/usr/bin/env bash
	find . -name '*.sops.*' -not -name '.sops.yaml' -not -path '*/node_modules/*' -not -path '*/.git/*' | sort

# add/ remove keys (if .sops.yaml setup was changed)
[group('ENCRYPTION')]
update-keys:
	#!/usr/bin/env bash
	set -euo pipefail
	while IFS= read -r file; do
		sops updatekeys -y "$file"
	done < <(just _sops-files)

# add/ remove a single key (if .sops.yaml setup was changed)
[group('ENCRYPTION')]
update-key file:
	sops updatekeys -y {{ file }}

# rotate keys (refreshed internal encryption keys)
[group('ENCRYPTION')]
rotate-keys:
	#!/usr/bin/env bash
	set -euo pipefail
	while IFS= read -r file; do
		sops rotate --in-place "$file"
	done < <(just _sops-files)

# rotate a single key (refreshed internal encryption key)
[group('ENCRYPTION')]
rotate-key file:
	sops rotate --in-place {{ file }}

# list PGP keys and their fingerprints
[group('ENCRYPTION')]
list-pgp:
	gpg --list-keys

# make changes to a secret file
[group('ENCRYPTION')]
edit-key file:
	EDITOR=nano sops edit {{ file }}

# decrypt a secret file
[confirm('This will overwrite any previously decrypted files, are you sure? (type `yes` to continue)')]
[group('ENCRYPTION')]
decrypt-key file:
	sops --output $(echo {{ file }} | sed 's/\.sops//g') --decrypt {{ file }}

# decrypt all secret files
[confirm('This will overwrite all previously decrypted files, are you sure? (type `yes` to continue)')]
[group('ENCRYPTION')]
decrypt:
	just decrypt-key .env.sops.yaml
	just decrypt-key keys/radioplayer-api-keys.sops.json
