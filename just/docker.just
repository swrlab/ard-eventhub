# Build the ingest image and push it to one host's zot.
# Tag: <UTC timestamp>--v<package.json version>, stored as ingest:<tag>.
# Credentials come from .env.docker.sops.yaml, same as registry-sync.

# print `export REGISTRY=...` and `export REF=...` for the host
_image-ref host:
	#!/usr/bin/env bash
	set -euo pipefail
	server=$(just --quiet _nix-server {{ quote(host) }})
	package_version=$(bun -e 'console.log((await Bun.file("package.json").json()).version)')
	version="$(date -u +%Y-%m-%d-%H-%M-%S)--v${package_version}"
	registry="${server}:5000"
	printf 'export REGISTRY=%q\n' "$registry"
	printf 'export REF=%q\n' "${registry}/ingest:${version}"

# build linux/arm64 and linux/amd64 with Docker, then push to <server>:5000
[group('DOCKER')]
build-docker host:
	sops exec-env --same-process .env.docker.sops.yaml "just _build-docker {{ quote(host) }}"

_build-docker host:
	#!/usr/bin/env bash
	set -euo pipefail
	if [[ -z "${REGISTRY_USER:-}" || -z "${REGISTRY_PASSWORD:-}" ]]; then
		echo "REGISTRY_USER and REGISTRY_PASSWORD must be set in .env.docker.sops.yaml" >&2
		exit 1
	fi
	exports=$(just --quiet _image-ref {{ quote(host) }}) || exit 1
	eval "$exports"
	if ! command -v docker >/dev/null || ! command -v crane >/dev/null; then
		echo "docker and crane must be on PATH" >&2
		exit 1
	fi

	tmp=$(mktemp -d)
	cfg=$(mktemp -d)
	trap 'rm -rf "$tmp" "$cfg"' EXIT
	docker buildx build --platform linux/arm64,linux/amd64 --output "type=oci,dest=${tmp}/image.tar" .
	tar -xf "${tmp}/image.tar" -C "$tmp"
	rm "${tmp}/image.tar"
	printf '%s' "$REGISTRY_PASSWORD" | DOCKER_CONFIG="$cfg" crane auth login "$REGISTRY" --insecure \
		--username "$REGISTRY_USER" --password-stdin >/dev/null
	DOCKER_CONFIG="$cfg" crane push --insecure "$tmp" "$REF"
	echo "pushed ${REF}"

# build linux/arm64 and linux/amd64 with the Apple container CLI, then push to <server>:5000
[group('DOCKER')]
build-container host:
	sops exec-env --same-process .env.docker.sops.yaml "just _build-container {{ quote(host) }}"

_build-container host:
	#!/usr/bin/env bash
	set -euo pipefail
	if [[ -z "${REGISTRY_USER:-}" || -z "${REGISTRY_PASSWORD:-}" ]]; then
		echo "REGISTRY_USER and REGISTRY_PASSWORD must be set in .env.docker.sops.yaml" >&2
		exit 1
	fi
	exports=$(just --quiet _image-ref {{ quote(host) }}) || exit 1
	eval "$exports"
	if ! command -v container >/dev/null; then
		echo "Apple container CLI is not on PATH" >&2
		exit 1
	fi

	printf '%s' "$REGISTRY_PASSWORD" | container registry login "$REGISTRY" \
		--scheme http --username "$REGISTRY_USER" --password-stdin
	container system start
	container build --tag "$REF" --platform linux/arm64 --platform linux/amd64 .
	container image push --scheme http "$REF"
	container image rm "$REF" >/dev/null
	echo "pushed ${REF}"
