# use a default sops file, or allow to be overridden by SOPS_ENV_FILE environment variable
DEFAULT_SOPS_FILE := '.env.sops.yaml'
SELECTED_SOPS_FILE := env('SOPS_ENV_FILE', DEFAULT_SOPS_FILE)

# run a command with the selected sops file (injecting environment variables)
[group('ENCRYPTION')]
env *args:
	sops exec-env --same-process {{ SELECTED_SOPS_FILE }} "{{ args }}"

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
