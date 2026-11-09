# Copy infra/kubernetes/external-images.txt into the zot registry on one machine.
# The registry is http://<server>:5000 (k3s LoadBalancer). Credentials come from
# .env.docker.sops.yaml (REGISTRY_USER, REGISTRY_PASSWORD).

# copy each pinned image to one host, skipping a tag whose digest already matches
[group('K3S')]
registry-sync host:
	sops exec-env --same-process .env.docker.sops.yaml "just _registry-sync {{ quote(host) }}"

_registry-sync host:
	#!/usr/bin/env bash
	set -euo pipefail
	server=$(just --quiet _nix-server {{ quote(host) }})
	registry="${server}:5000"
	if [[ -z "${REGISTRY_USER:-}" || -z "${REGISTRY_PASSWORD:-}" ]]; then
		echo "REGISTRY_USER and REGISTRY_PASSWORD must be set in .env.docker.sops.yaml" >&2
		exit 1
	fi
	if ! command -v crane >/dev/null; then
		echo "crane is not on PATH; run mise install" >&2
		exit 1
	fi

	export DOCKER_CONFIG
	DOCKER_CONFIG=$(mktemp -d)
	trap 'rm -rf "$DOCKER_CONFIG"' EXIT
	printf '%s' "$REGISTRY_PASSWORD" | crane auth login "$registry" --insecure \
		--username "$REGISTRY_USER" --password-stdin >/dev/null
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
		if dst_digest=$(crane digest --insecure "$dest" 2>/dev/null); then
			if [[ "$src_digest" == "$dst_digest" ]]; then
				echo "current  $line"
				continue
			fi
		fi
		echo "copy     $line"
		crane copy --insecure "$line" "$dest"
	done < infra/kubernetes/external-images.txt
