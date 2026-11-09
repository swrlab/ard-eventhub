# Mirror infra/kubernetes/external-images.txt into the zot registry on a machine.
# zot is ClusterIP and HTTP, so registry-sync port-forwards svc/registry with that
# host's kubeconfig and crane-copies each image. REGISTRY_USER and REGISTRY_PASSWORD
# are the htpasswd user; Secret registry-htpasswd only stores the bcrypt hash.
# registry-sync-all uses the same pair on every host. If a machine differs, sync it alone.

IMAGES := 'infra/kubernetes/external-images.txt'

# print one canonical source and the repository path stored in zot, tab-separated
_registry-map:
	#!/usr/bin/env bash
	set -euo pipefail
	file={{ quote(IMAGES) }}
	line_no=0
	while IFS= read -r line || [[ -n "$line" ]]; do
		line_no=$((line_no + 1))
		line="${line%%#*}"
		line="${line#"${line%%[![:space:]]*}"}"
		line="${line%"${line##*[![:space:]]}"}"
		[[ -z "$line" ]] && continue
		if [[ "$line" == *@* || "$line" == *" "* ]]; then
			echo "$file:$line_no: use registry/repository:tag, not a digest: $line" >&2
			exit 1
		fi
		colons="${line//[^:]/}"
		if [[ ${#colons} -ne 1 || "$line" != */*:* ]]; then
			echo "$file:$line_no: need registry/repository:tag: $line" >&2
			exit 1
		fi
		tag="${line##*:}"
		repo="${line%:*}"
		host="${repo%%/*}"
		path="${repo#*/}"
		if [[ "$host" != *.* || -z "$path" || -z "$tag" ]]; then
			echo "$file:$line_no: need a fully qualified registry host: $line" >&2
			exit 1
		fi
		case "$tag" in
			latest|main|master|dev|develop|edge|nightly|unstable|stable)
				echo "$file:$line_no: pin a version, not $tag" >&2
				exit 1
				;;
		esac
		printf '%s\t%s:%s\n' "$line" "$path" "$tag"
	done < "$file"

# show what registry-sync would copy
[group('K3S')]
registry-list:
	#!/usr/bin/env bash
	set -euo pipefail
	just --quiet _registry-map | while IFS=$'\t' read -r src dest; do
		printf '%s\n  -> <registry>/%s\n' "$src" "$dest"
	done

# fail when services/ image: lines and external-images.txt disagree
[group('K3S')]
registry-check:
	#!/usr/bin/env bash
	set -euo pipefail
	expected=$(mktemp)
	actual=$(mktemp)
	trap 'rm -f "$expected" "$actual"' EXIT

	normalize() {
		local image="$1" tag repo first
		if [[ "$image" != *:* ]]; then
			printf '%s\n' "$image"
			return
		fi
		tag="${image##*:}"
		repo="${image%:*}"
		first="${repo%%/*}"
		if [[ "$repo" != */* ]]; then
			printf 'docker.io/library/%s:%s\n' "$repo" "$tag"
			return
		fi
		if [[ "$first" != *.* && "$first" != *:* && "$first" != localhost ]]; then
			printf 'docker.io/%s:%s\n' "$repo" "$tag"
			return
		fi
		printf '%s\n' "$image"
	}

	skip() {
		case "$1" in
			eventhub-connect|eventhub-connect:*|ghcr.io/project-zot/zot|ghcr.io/project-zot/zot:*) return 0 ;;
		esac
		return 1
	}

	while IFS= read -r file; do
		[[ -n "$file" ]] || continue
		while IFS= read -r line || [[ -n "$line" ]]; do
			[[ -n "$line" ]] || continue
			value="${line#*:}"
			value="${value#"${value%%[![:space:]]*}"}"
			value="${value%"${value##*[![:space:]]}"}"
			value="${value#\"}"
			value="${value%\"}"
			value="${value#\'}"
			value="${value%\'}"
			canon=$(normalize "$value")
			skip "$canon" && continue
			printf '%s\n' "$canon"
		done < <(grep -E '^[[:space:]]+image:[[:space:]]+' "$file" || true)
	done < <(find infra/kubernetes/services -name '*.yaml' -type f | sort) | sort -u > "$expected"

	just --quiet _registry-map | cut -f1 | sort -u > "$actual"

	missing=$(comm -23 "$expected" "$actual" || true)
	extra=$(comm -13 "$expected" "$actual" || true)
	if [[ -n "$missing" || -n "$extra" ]]; then
		if [[ -n "$missing" ]]; then
			echo "in services/ but not in {{ IMAGES }}:" >&2
			while IFS= read -r item; do
				printf '  %s\n' "$item" >&2
			done <<< "$missing"
		fi
		if [[ -n "$extra" ]]; then
			echo "in {{ IMAGES }} but not in services/:" >&2
			while IFS= read -r item; do
				printf '  %s\n' "$item" >&2
			done <<< "$extra"
		fi
		exit 1
	fi
	echo "external images match services/"

# copy external-images.txt into the zot registry on one host
[group('K3S')]
registry-sync host:
	#!/usr/bin/env bash
	set -euo pipefail
	host={{ quote(host) }}
	kubeconfig={{ quote('keys/' + host + '-k3s-cert.yaml') }}

	if ! awk -v name="$host" '$1 == name { found = 1 } END { exit !found }' infra/nixos/hosts; then
		echo "unknown host: $host" >&2
		exit 1
	fi
	if [[ ! -f "$kubeconfig" ]]; then
		echo "missing $kubeconfig; run: just k3s-decrypt $host" >&2
		exit 1
	fi
	if [[ -z "${REGISTRY_USER:-}" || -z "${REGISTRY_PASSWORD:-}" ]]; then
		echo "set REGISTRY_USER and REGISTRY_PASSWORD (the htpasswd user for registry-htpasswd)" >&2
		exit 1
	fi
	if ! command -v crane >/dev/null; then
		echo "crane is not on PATH; run mise install" >&2
		exit 1
	fi
	if ! command -v kubectl >/dev/null; then
		echo "kubectl is not on PATH" >&2
		exit 1
	fi

	just registry-check

	pf=""
	log=""
	map=""
	docker_config=""
	login_err=""
	cleanup() {
		if [[ -n "$pf" ]]; then
			kill "$pf" 2>/dev/null || true
			wait "$pf" 2>/dev/null || true
		fi
		[[ -n "$log" ]] && rm -f "$log"
		[[ -n "$map" ]] && rm -f "$map"
		[[ -n "$login_err" ]] && rm -f "$login_err"
		[[ -n "$docker_config" ]] && rm -rf "$docker_config"
	}
	trap cleanup EXIT

	log=$(mktemp)
	kubectl --kubeconfig "$kubeconfig" -n registry port-forward --address 127.0.0.1 svc/registry :5000 >"$log" 2>&1 &
	pf=$!
	port=""
	for _ in $(seq 1 50); do
		if ! kill -0 "$pf" 2>/dev/null; then
			cat "$log" >&2
			exit 1
		fi
		port=$(sed -n 's/.*127\.0\.0\.1:\([0-9][0-9]*\).*/\1/p' "$log")
		port="${port%%$'\n'*}"
		[[ -n "$port" ]] && break
		sleep 0.1
	done
	if [[ -z "$port" ]]; then
		echo "port-forward to svc/registry did not open" >&2
		cat "$log" >&2
		exit 1
	fi

	docker_config=$(mktemp -d)
	export DOCKER_CONFIG="$docker_config"
	login_err=$(mktemp)
	logged_in=0
	for _ in $(seq 1 25); do
		if printf '%s' "$REGISTRY_PASSWORD" | crane auth login "127.0.0.1:${port}" --insecure \
			--username "$REGISTRY_USER" --password-stdin >"$login_err" 2>&1; then
			logged_in=1
			break
		fi
		sleep 0.2
	done
	if [[ "$logged_in" -ne 1 ]]; then
		echo "registry login failed" >&2
		cat "$login_err" >&2
		exit 1
	fi

	echo "mirroring to 127.0.0.1:${port} on ${host}"
	map=$(mktemp)
	just --quiet _registry-map > "$map"
	while IFS=$'\t' read -r src dest; do
		[[ -n "$src" ]] || continue
		target="127.0.0.1:${port}/${dest}"
		src_digest=$(crane digest "$src") || exit 1
		dst_digest=""
		if dst_digest=$(crane digest --insecure "$target" 2>/dev/null); then
			if [[ "$src_digest" == "$dst_digest" ]]; then
				echo "current  $src"
				continue
			fi
		fi
		echo "copy     $src -> $target"
		crane copy --insecure "$src" "$target"
	done < "$map"

# copy external-images.txt into zot on every host
[group('K3S')]
registry-sync-all:
	#!/usr/bin/env bash
	set -euo pipefail
	while IFS= read -r host; do
		[[ -n "$host" ]] || continue
		just registry-sync "$host"
	done < <(just --quiet _nix-hosts)
