# run just in the CLI to see the list of shortcuts
_default:
	just --list

# use a default sops file, or allow to be overridden by SOPS_ENV_FILE environment variable
DEFAULT_SOPS_FILE:= '.env.sops.yaml'
SELECTED_SOPS_FILE:= env('SOPS_ENV_FILE', DEFAULT_SOPS_FILE)

# run a command with the selected sops file (injecting environment variables)
[group('ENCRYPTION')]
env *args:
	sops exec-env --same-process {{SELECTED_SOPS_FILE}} "{{args}}"

## ---------------------------------

# run the ingest tests locally
test:
	bun run test

# generate a coreId for a given text
coreId text:
	bun run coreId "{{text}}"

# start the ingest service in development mode
dev:
	bun run ingest

# serve the documentation
docs:
	bun run docs:serve

## ---------------------------------
## ENCRYPTION shortcuts

# add/ remove keys (if .sops.yaml setup was changed)
[group('ENCRYPTION')]
update-keys:
	just _update-key .env.sops.yaml
	just _update-key config/radioplayer-api-keys.sops.json

_update-key file:
	sops updatekeys {{file}}

# rotate keys (refreshed internal encryption keys)
[group('ENCRYPTION')]
rotate-keys:
	just _rotate-key .env.sops.yaml
	just _rotate-key config/radioplayer-api-keys.sops.json

_rotate-key file:
	sops rotate --in-place {{file}}

# list PGP keys and their fingerprints
[group('ENCRYPTION')]
list-pgp:
	gpg --list-keys

# make changes to a secret file
[group('ENCRYPTION')]
edit-key file:
	EDITOR=nano sops edit {{file}}

# decrypt a secret file
[group('ENCRYPTION')]
[confirm('This will overwrite any previously decrypted files, are you sure? (type `yes` to continue)')]
decrypt-key file:
	sops --output $(echo {{file}} | sed 's/\.sops//g') --decrypt {{file}}

# decrypt all secret files
[group('ENCRYPTION')]
[confirm('This will overwrite all previously decrypted files, are you sure? (type `yes` to continue)')]
decrypt:
	just decrypt-key .env.sops.yaml
	just decrypt-key config/radioplayer-api-keys.sops.json
