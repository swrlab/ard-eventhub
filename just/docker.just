# Build the eventhub-connect image once and push it to every host's zot.
# Tag: <UTC timestamp>--v<package.json version>, stored as eventhub-connect:<tag>.
# Hosts come from infra/nixos/hosts.toml. Run `just registry-local-setup` once to
# store zot credentials in the local Docker config and the container keychain.
# build-docker stages its OCI layout under .local/tmp and removes it on exit.

IMAGE_TMP := justfile_directory() / '.local/tmp'

# print the image tag, shared by every host
_image-version:
	#!/usr/bin/env bash
	set -euo pipefail
	package_version=$(bun -e 'console.log((await Bun.file("package.json").json()).version)')
	printf '%s\n' "$(date -u +%Y-%m-%d-%H-%M-%S)--v${package_version}"

# print `<registry>/eventhub-connect:<version>` for every host, one per line
_image-targets version:
	#!/usr/bin/env bash
	set -euo pipefail
	version={{ quote(version) }}
	found=0
	while read -r host; do
		[[ -z "$host" ]] && continue
		registry=$(just --quiet _registry-host "$host")
		printf '%s\n' "${registry}/eventhub-connect:${version}"
		found=1
	done < <(just --quiet _nix-list-friendly-names)
	if [[ "$found" -eq 0 ]]; then
		echo "no hosts in infra/nixos/hosts.toml" >&2
		exit 1
	fi

# build linux/arm64 and linux/amd64 with Docker, then push to every host's registry
[group('DOCKER')]
build-docker:
	#!/usr/bin/env bash
	set -euo pipefail
	if ! command -v docker >/dev/null || ! command -v crane >/dev/null; then
		echo "docker and crane must be on PATH" >&2
		exit 1
	fi

	version=$(just --quiet _image-version)
	targets=$(just --quiet _image-targets "$version")
	mkdir -p {{ quote(IMAGE_TMP) }}
	export TMPDIR={{ quote(IMAGE_TMP) }}
	tmp=$(mktemp -d {{ quote(IMAGE_TMP / 'eventhub-connect.XXXXXX') }})
	echo "version=${version}"
	echo "targets=${targets}"
	echo "tmp=${tmp}"
	trap 'rm -rf "$tmp"' EXIT

	docker buildx build -f Dockerfile.connect --platform linux/arm64,linux/amd64 --output "type=oci,dest=${tmp}/image.tar" .
	tar -xf "${tmp}/image.tar" -C "$tmp"
	rm "${tmp}/image.tar"

	while read -r ref; do
		[[ -z "${ref}" ]] && continue
		crane push {{ CRANE_TLS }} "$tmp" "$ref"
		echo "pushed ${ref}"
	done <<< "$targets"

# build linux/arm64 and linux/amd64 with the Apple container CLI, then push to every host's registry
[group('DOCKER')]
build-container:
	#!/usr/bin/env bash
	set -euo pipefail
	if ! command -v container >/dev/null; then
		echo "Apple container CLI must be on PATH" >&2
		exit 1
	fi

	version=$(just --quiet _image-version)
	targets=$(just --quiet _image-targets "$version")
	local_ref="eventhub-connect:${version}"
	refs=("$local_ref")
	trap 'container image rm --force "${refs[@]}" >/dev/null 2>&1 || true' EXIT
	echo "version=${version}"
	echo "targets=${targets}"

	container system start
	container build -f Dockerfile.connect --tag "$local_ref" --platform linux/arm64 --platform linux/amd64 .

	while read -r ref; do
		[[ -z "${ref}" ]] && continue
		container image tag "$local_ref" "$ref"
		refs+=("$ref")
		container image push "$ref"
		echo "pushed ${ref}"
	done <<< "$targets"
