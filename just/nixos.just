# NixOS host config sync over SSH — local commands, run from the repo.
# Central tree: ./nixos/ (common/, one directory per host, flake.nix, justfile, README.md).
# Recipes take the friendly name (eventhub-connect-mnz). nixos/hosts maps that name
# to the server number, which is the SSH target and the NixOS hostname.
# The justfile inside ./nixos/ holds the commands that run ON a host
# (rebuild, rollback, upgrade, clean); it is uploaded with the tree.

# friendly names from nixos/hosts, one per line
_nix-hosts:
	#!/usr/bin/env bash
	set -euo pipefail
	awk '!/^[[:space:]]*#/ && NF { print $1 }' nixos/hosts

# server number mapped from a friendly name
_nix-server host:
	#!/usr/bin/env bash
	set -euo pipefail
	server=$(awk -v name="{{ host }}" '$1 == name { print $2; exit }' nixos/hosts)
	if [[ -z "$server" ]]; then
		echo "no server number for {{ host }} in nixos/hosts" >&2
		exit 1
	fi
	printf '%s\n' "$server"

# open a root shell on a host
[group('NIX')]
ssh host:
	#!/usr/bin/env bash
	set -euo pipefail
	exec ssh "root@$(just --quiet _nix-server {{ host }})"

# upload via ssh — the full ./nixos/ folder (common, flake, all hosts, justfile)
[group('NIX')]
nix-upload host:
	#!/usr/bin/env bash
	set -euo pipefail
	server=$(just --quiet _nix-server {{ host }})
	scp -r ./nixos/ "root@${server}:/etc/"
alias nixu := nix-upload

# download via ssh — the host's own subtree plus the flake lock
[group('NIX')]
nix-download host:
	#!/usr/bin/env bash
	set -euo pipefail
	server=$(just --quiet _nix-server {{ host }})
	rm -rf "./nixos/{{ host }}/"
	mkdir -p ./nixos/
	scp -r "root@${server}:/etc/nixos/{{ host }}/" ./nixos/
	scp "root@${server}:/etc/nixos/flake.lock" ./nixos/flake.lock || true
alias nixd := nix-download

# download all nix configs via ssh
[group('NIX')]
nix-download-all:
	#!/usr/bin/env bash
	set -euo pipefail
	just _nix-hosts | while read -r host; do
		just nix-download "$host" || exit 1
	done
alias nixda := nix-download-all

# evaluate the flake locally (no build, nothing applied)
[group('NIX')]
nix-check:
	nix flake check --impure ./nixos

# apply the local Nix config to one host: upload, rebuild, sync the flake lock back
[group('NIX')]
nix-apply host:
	#!/usr/bin/env bash
	set -euo pipefail
	server=$(just --quiet _nix-server {{ host }})
	just nix-upload {{ host }}
	ssh "root@${server}" "cd /etc/nixos && just --yes flake {{ host }}"
	scp "root@${server}:/etc/nixos/flake.lock" ./nixos/flake.lock || true
alias nixp := nix-apply

# apply local Nix config to all hosts
[group('NIX')]
nix-all:
	#!/usr/bin/env bash
	set -euo pipefail
	just _nix-hosts | while read -r host; do
		just nix-apply "$host" || exit 1
	done
alias nix-auto := nix-all
alias nixa := nix-all
