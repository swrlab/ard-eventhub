# Build the ingest image once and push it to every host's zot.
# Tag: <UTC timestamp>--v<package.json version>, stored as ingest:<tag>.
# Hosts come from infra/nixos/hosts. Credentials come from .env.docker.sops.yaml,
# same as registry-sync.

# print the image tag, shared by every host
_image-version:
	#!/usr/bin/env bash
	set -euo pipefail
	package_version=$(bun -e 'console.log((await Bun.file("package.json").json()).version)')
	printf '%s\n' "$(date -u +%Y-%m-%d-%H-%M-%S)--v${package_version}"

# print `registry ref` for every host, one pair per line
_image-targets version:
	#!/usr/bin/env bash
	set -euo pipefail
	version={{ quote(version) }}
	found=0
	while read -r host; do
		[[ -z "$host" ]] && continue
		server=$(just --quiet _nix-server "$host")
		registry="${server}:5000"
		printf '%s %s\n' "$registry" "${registry}/ingest:${version}"
		found=1
	done < <(just --quiet _nix-hosts)
	if [[ "$found" -eq 0 ]]; then
		echo "no hosts in infra/nixos/hosts" >&2
		exit 1
	fi

# build linux/arm64 and linux/amd64 with Docker, then push to every host's :5000
[group('DOCKER')]
build-docker:
	sops exec-env --same-process .env.docker.sops.yaml "just _build-docker"

_build-docker:
	#!/usr/bin/env bash
	set -euo pipefail
	if [[ -z "${REGISTRY_USER:-}" || -z "${REGISTRY_PASSWORD:-}" ]]; then
		echo "REGISTRY_USER and REGISTRY_PASSWORD must be set in .env.docker.sops.yaml" >&2
		exit 1
	fi
	if ! command -v docker >/dev/null || ! command -v crane >/dev/null; then
		echo "docker and crane must be on PATH" >&2
		exit 1
	fi

	version=$(just --quiet _image-version)
	targets=$(just --quiet _image-targets "$version")
	tmp=$(mktemp -d)
	cfg=$(mktemp -d)
	trap 'rm -rf "$tmp" "$cfg"' EXIT
	docker buildx build --platform linux/arm64,linux/amd64 --output "type=oci,dest=${tmp}/image.tar" .
	tar -xf "${tmp}/image.tar" -C "$tmp"
	rm "${tmp}/image.tar"

	while read -r registry ref; do
		[[ -z "${registry}" ]] && continue
		printf '%s' "$REGISTRY_PASSWORD" | DOCKER_CONFIG="$cfg" crane auth login "$registry" --insecure \
			--username "$REGISTRY_USER" --password-stdin >/dev/null
		DOCKER_CONFIG="$cfg" crane push --insecure "$tmp" "$ref"
		echo "pushed ${ref}"
	done <<< "$targets"

# build linux/arm64 and linux/amd64 with the Apple container CLI, then push to every host's :5000
[group('DOCKER')]
build-container:
	sops exec-env --same-process .env.docker.sops.yaml "just _build-container"

_build-container:
	#!/usr/bin/env bash
	set -euo pipefail
	if [[ -z "${REGISTRY_USER:-}" || -z "${REGISTRY_PASSWORD:-}" ]]; then
		echo "REGISTRY_USER and REGISTRY_PASSWORD must be set in .env.docker.sops.yaml" >&2
		exit 1
	fi
	if ! command -v container >/dev/null || ! command -v crane >/dev/null || ! command -v rsync >/dev/null; then
		echo "Apple container CLI, crane, and rsync must be on PATH" >&2
		exit 1
	fi

	version=$(just --quiet _image-version)
	targets=$(just --quiet _image-targets "$version")
	local_ref="ingest:${version}"
	tmp=$(mktemp -d)
	cfg=$(mktemp -d)
	context=$(mktemp -d)
	trap 'rm -rf "$tmp" "$cfg" "$context"; container image rm --force "$local_ref" >/dev/null 2>&1 || true' EXIT

	grep -v -e '^#' -e '^$' .dockerignore | rsync -a --exclude-from=- ./ "$context/"
	container system start
	container build --tag "$local_ref" --platform linux/arm64 --platform linux/amd64 "$context"
	container image save --output "${tmp}/image.tar" "$local_ref"
	tar -xf "${tmp}/image.tar" -C "$tmp"
	rm "${tmp}/image.tar"

	while read -r registry ref; do
		[[ -z "${registry}" ]] && continue
		printf '%s' "$REGISTRY_PASSWORD" | DOCKER_CONFIG="$cfg" crane auth login "$registry" --insecure \
			--username "$REGISTRY_USER" --password-stdin >/dev/null
		DOCKER_CONFIG="$cfg" crane push --insecure "$tmp" "$ref"
		echo "pushed ${ref}"
	done <<< "$targets"
