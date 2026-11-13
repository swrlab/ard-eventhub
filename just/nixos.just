# NixOS host config sync over SSH — local commands, run from the repo.
# Central tree: ./infra/nixos/ (common/, one directory per host, flake.nix, justfile, README.md).
# Recipes take the friendly name (eventhub-connect-mnz) or its alias (mnz). infra/nixos/hosts.toml maps
# that name to the server number, which is the SSH target and the NixOS hostname.
# The justfile inside ./infra/nixos/ holds the commands that run ON a host
# (rebuild, rollback, upgrade, clean); it is uploaded with the tree.

# friendly names from infra/nixos/hosts.toml, one per line
_nix-list-friendly-names:
	#!/usr/bin/env bash
	exec bun ./src/cli/hosts.ts names

# friendly name mapped from a friendly name or alias
_nix-alias-to-friendly-name host:
	#!/usr/bin/env bash
	exec bun ./src/cli/hosts.ts name {{ quote(host) }}

# server name (NixOS hostname and SSH target) mapped from a friendly name or alias
_nix-alias-to-server-name host:
	#!/usr/bin/env bash
	exec bun ./src/cli/hosts.ts server {{ quote(host) }}

# open a root shell on a host
[group('NIX')]
ssh host:
	exec ssh "root@$(just --quiet _nix-alias-to-server-name {{ host }})"

# upload via ssh — the full ./infra/nixos/ folder (common, flake, all hosts, justfile)
[group('NIX')]
nix-upload host:
	scp -r ./infra/nixos/ "root@$(just --quiet _nix-alias-to-server-name {{ host }}):/etc/"
alias nixu := nix-upload

# download via ssh — the host's own subtree plus the flake lock
[group('NIX')]
nix-download host:
	#!/usr/bin/env bash
	set -euo pipefail
	host=$(just --quiet _nix-alias-to-friendly-name {{ quote(host) }})
	server=$(just --quiet _nix-alias-to-server-name "$host")
	rm -rf "./infra/nixos/${host}/"
	mkdir -p ./infra/nixos/
	scp -r "root@${server}:/etc/nixos/${host}/" ./infra/nixos/
	scp "root@${server}:/etc/nixos/flake.lock" ./infra/nixos/flake.lock || true
alias nixd := nix-download

# download all nix configs via ssh
[group('NIX')]
nix-download-all:
	#!/usr/bin/env bash
	set -euo pipefail
	just _nix-list-friendly-names | while read -r host; do
		just nix-download "$host" || exit 1
	done
alias nixda := nix-download-all

# initial download of nix config after first install
[confirm]
[group('NIX')]
nix-download-init host:
	scp -r "root@$(just --quiet _nix-alias-to-server-name {{ host }}):/etc/nixos/" ./infra/nixos/

# evaluate the flake locally (no build, nothing applied)
[group('NIX')]
nix-check:
	nix flake check --impure ./infra/nixos

# apply the local Nix config to one host: upload, rebuild, sync the flake lock back
[group('NIX')]
nix-apply host:
	#!/usr/bin/env bash
	set -euo pipefail
	host=$(just --quiet _nix-alias-to-friendly-name {{ quote(host) }})
	server=$(just --quiet _nix-alias-to-server-name "$host")
	just nix-upload "$host"
	ssh "root@${server}" "cd /etc/nixos && just --yes flake ${host}"
	scp "root@${server}:/etc/nixos/flake.lock" ./infra/nixos/flake.lock || true
alias nixp := nix-apply
