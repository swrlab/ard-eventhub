# Manage the zot registry on each host.
# The registry is https://eventhub-connect-<zone>-dev.swr.ard:5000, TLS by Traefik with the dev
# certificate. Credentials come from .env.k3s.sops.yaml (REGISTRY_USER, REGISTRY_PASSWORD).

# crane skips TLS verification only when asked, for a registry that still serves a placeholder
# certificate (REGISTRY_INSECURE=1 just registry-sync bad)
CRANE_TLS := if env('REGISTRY_INSECURE', '') == '' { '' } else { '--insecure' }

# print host:port of a host's registry, a SAN of the dev certificate
_registry-host host:
	#!/usr/bin/env bash
	set -euo pipefail
	printf '%s-dev.swr.ard:5000\n' "$(just --quiet _nix-alias-to-friendly-name {{ quote(host) }})"

# write zot credentials for every host into the local Docker config and the container keychain
[group('K3S')]
registry-local-setup:
	sops exec-env --same-process .env.k3s.sops.yaml "just _registry-local-setup"

# log crane (and the Apple container CLI, if present) in to each host's zot registry using the decrypted env vars
_registry-local-setup:
	#!/usr/bin/env bash
	set -euo pipefail
	if [[ -z "${REGISTRY_USER:-}" || -z "${REGISTRY_PASSWORD:-}" ]]; then
		echo "REGISTRY_USER and REGISTRY_PASSWORD must be set in .env.k3s.sops.yaml" >&2
		exit 1
	fi
	if ! command -v crane >/dev/null; then
		echo "crane is not on PATH; run mise install" >&2
		exit 1
	fi

	while read -r host; do
		[[ -z "$host" ]] && continue
		registry=$(just --quiet _registry-host "$host")
		printf '%s' "$REGISTRY_PASSWORD" | crane auth login "$registry" \
			--username "$REGISTRY_USER" --password-stdin
		if command -v container >/dev/null; then
			printf '%s' "$REGISTRY_PASSWORD" | container registry login "$registry" \
				--username "$REGISTRY_USER" --password-stdin
		fi
	done < <(just --quiet _nix-list-friendly-names)

# copy each pinned image to one host, skipping a tag whose digest already matches
[group('K3S')]
registry-sync host:
	#!/usr/bin/env bash
	set -euo pipefail
	if ! command -v crane >/dev/null; then
		echo "crane is not on PATH; run mise install" >&2
		exit 1
	fi
	registry=$(just --quiet _registry-host {{ quote(host) }})
	echo "syncing to ${registry}"

	while IFS= read -r line || [[ -n "$line" ]]; do
		line="${line%%#*}"
		line="${line#"${line%%[![:space:]]*}"}"
		line="${line%"${line##*[![:space:]]}"}"
		[[ -z "$line" ]] && continue
		if [[ "$line" != */*:* ]]; then
			echo "need registry/repository:tag, got: $line" >&2
			exit 1
		fi
		repo="${line%:*}"
		tag="${line##*:}"
		dest="${registry}/${repo#*/}:${tag}"
		src_digest=$(crane digest "$line")
		if dst_digest=$(crane digest {{ CRANE_TLS }} "$dest" 2>/dev/null); then
			if [[ "$src_digest" == "$dst_digest" ]]; then
				echo "current  $line"
				continue
			fi
		fi
		echo "copy     $line"
		crane copy {{ CRANE_TLS }} "$line" "$dest"
	done < infra/kubernetes/external-images.txt

# copy each pinned image to every host in infra/nixos/hosts.toml
[group('K3S')]
registry-sync-all:
	#!/usr/bin/env bash
	set -euo pipefail
	just --quiet _nix-list-friendly-names | while read -r host; do
		just registry-sync "$host" || exit 1
	done
