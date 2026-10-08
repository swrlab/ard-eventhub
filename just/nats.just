NATS_IMAGE := 'nats:2.14.6'
NATS_NAME := 'eventhub-nats'
NATS_CONF := source_directory() / '../infra/nats/nats-dev.conf'
NATS_USERS := source_directory() / '../infra/nats/nats-users.conf'
NATS_INVALID := source_directory() / '../infra/nats/nats-invalid.conf'
NATS_STORE := source_directory() / '../.local/nats'
NATS_RUNTIME_CONF := NATS_STORE / 'nats.conf'
NATS_RUNTIME_USERS := NATS_STORE / 'nats-users.conf'
NATS_DEFAULT_INSTITUTION := 'urn:ard:institution:a3004ff924ece1a2'
NATS_K8S := source_directory() / '../infra/kubernetes'

# copy committed NATS config into the writable runtime dir (hot-reload edits this copy)
[group('NATS')]
_nats-stage-conf:
	#!/usr/bin/env bash
	set -euo pipefail
	mkdir -p "{{ NATS_STORE }}"
	cp "{{ NATS_CONF }}" "{{ NATS_RUNTIME_CONF }}"
	cp "{{ NATS_USERS }}" "{{ NATS_RUNTIME_USERS }}"

# start a local nats-server (Homebrew / PATH binary). MQTT binds :1883.
[group('NATS')]
nats-up: _nats-stage-conf
	#!/usr/bin/env bash
	set -euo pipefail
	if bash -c 'echo > /dev/tcp/127.0.0.1/4222' 2>/dev/null; then
		echo 'NATS already listening on 4222'
		exit 0
	fi
	if ! command -v nats-server >/dev/null; then
		echo 'nats-server not on PATH. brew install nats-server  or  just nats-up-docker' >&2
		exit 1
	fi
	if bash -c 'echo > /dev/tcp/127.0.0.1/1883' 2>/dev/null; then
		echo 'port 1883 is in use — free it so NATS MQTT can bind' >&2
		exit 1
	fi
	export NATS_JS_STORE="{{ NATS_STORE }}"
	nats-server -c "{{ NATS_RUNTIME_CONF }}" >> "{{ NATS_STORE }}/nats-server.log" 2>&1 &
	echo $! > "{{ NATS_STORE }}/nats-server.pid"
	for _ in $(seq 1 30); do
		if bash -c 'echo > /dev/tcp/127.0.0.1/4222' 2>/dev/null; then
			echo 'NATS listening on 4222 (MQTT 1883, monitor 8222)'
			exit 0
		fi
		sleep 1
	done
	echo 'nats-server did not listen on 4222; see .local/nats/nats-server.log' >&2
	exit 1

# start NATS with docker (Cursor Cloud / Linux / CI). MQTT binds :1883.
[group('NATS')]
nats-up-docker: _nats-stage-conf
	#!/usr/bin/env bash
	set -euo pipefail
	if bash -c 'echo > /dev/tcp/127.0.0.1/4222' 2>/dev/null; then
		echo 'NATS already listening on 4222'
		exit 0
	fi
	if bash -c 'echo > /dev/tcp/127.0.0.1/1883' 2>/dev/null; then
		echo 'port 1883 is in use — free it so NATS MQTT can bind' >&2
		exit 1
	fi
	docker run \
		--detach \
		--rm \
		--name {{ NATS_NAME }} \
		--publish 4222:4222 \
		--publish 1883:1883 \
		--publish 8222:8222 \
		--volume "{{ NATS_RUNTIME_CONF }}:/etc/nats/nats-dev.conf" \
		--volume "{{ NATS_RUNTIME_USERS }}:/etc/nats/nats-users.conf" \
		--env NATS_JS_STORE=/data \
		--volume "{{ NATS_STORE }}:/data" \
		{{ NATS_IMAGE }} \
		-c /etc/nats/nats-dev.conf
	for _ in $(seq 1 30); do
		if bash -c 'echo > /dev/tcp/127.0.0.1/4222' 2>/dev/null; then
			exit 0
		fi
		sleep 1
	done
	echo 'NATS did not listen on 4222' >&2
	exit 1

# stop the local nats-server started by nats-up
[group('NATS')]
nats-down:
	#!/usr/bin/env bash
	set -euo pipefail
	pid_file="{{ NATS_STORE }}/nats-server.pid"
	if [[ -f "$pid_file" ]]; then
		kill "$(cat "$pid_file")" 2>/dev/null || true
		rm -f "$pid_file"
	fi

# stop the docker NATS container
[group('NATS')]
nats-down-docker:
	-docker stop {{ NATS_NAME }}

# validate the committed NATS config (`nats-server -t`); does not touch a running server
[group('NATS')]
nats-check:
	#!/usr/bin/env bash
	set -euo pipefail
	export NATS_JS_STORE="{{ NATS_STORE }}"
	mkdir -p "{{ NATS_STORE }}"
	if command -v nats-server >/dev/null; then
		nats-server -t -c "{{ NATS_CONF }}"
		exit 0
	fi
	docker run \
		--rm \
		--volume "{{ NATS_CONF }}:/etc/nats/nats-dev.conf:ro" \
		--volume "{{ NATS_USERS }}:/etc/nats/nats-users.conf:ro" \
		--env NATS_JS_STORE=/tmp \
		{{ NATS_IMAGE }} \
		-t -c /etc/nats/nats-dev.conf

# confirm a broken config is rejected (must fail). Safe to run while NATS is up.
[group('NATS')]
nats-check-invalid:
	#!/usr/bin/env bash
	set -euo pipefail
	if command -v nats-server >/dev/null; then
		if nats-server -t -c "{{ NATS_INVALID }}" >/tmp/nats-invalid.out 2>&1; then
			echo 'nats-check-invalid: broken config was accepted' >&2
			exit 1
		fi
		echo 'broken config rejected (expected)'
		exit 0
	fi
	if docker run \
		--rm \
		--volume "{{ NATS_INVALID }}:/etc/nats/nats-invalid.conf:ro" \
		{{ NATS_IMAGE }} \
		-t -c /etc/nats/nats-invalid.conf >/tmp/nats-invalid.out 2>&1; then
		echo 'nats-check-invalid: broken config was accepted' >&2
		exit 1
	fi
	echo 'broken config rejected (expected)'

# hot-reload the runtime config (edit .local/nats/nats-users.conf, then this). Does not restart.
[group('NATS')]
nats-reload:
	#!/usr/bin/env bash
	set -euo pipefail
	pid_file="{{ NATS_STORE }}/nats-server.pid"
	if [[ -f "$pid_file" ]]; then
		kill -HUP "$(cat "$pid_file")"
		echo 'sent HUP to local nats-server'
		exit 0
	fi
	if docker kill --signal HUP {{ NATS_NAME }} >/dev/null 2>&1; then
		echo 'sent HUP to docker NATS'
		exit 0
	fi
	echo 'no local nats-server pid and no docker container eventhub-nats' >&2
	exit 1

# print a bcrypt hash for nats-users.conf (`nats server passwd`, else Apache `htpasswd -B`)
[group('NATS')]
nats-passwd password='local':
	#!/usr/bin/env bash
	set -euo pipefail
	if command -v nats >/dev/null && nats server passwd -p "{{ password }}"; then
		exit 0
	fi
	if command -v htpasswd >/dev/null; then
		# `nats server passwd` refuses passwords shorter than 10 characters (`local` is 5).
		# Apache emits `$2y$`; rewrite to `$2a$` so nats-server always treats it as bcrypt.
		htpasswd -nbB -C 11 dummy "{{ password }}" | cut -d: -f2 | sed 's/^\$2y\$/$2a$/'
		exit 0
	fi
	echo 'need the nats CLI (brew install nats-io) or htpasswd' >&2
	exit 1

# stream local nats-server logs
[group('NATS')]
nats-logs:
	tail -f "{{ NATS_STORE }}/nats-server.log"

# stream docker NATS logs
[group('NATS')]
nats-logs-docker:
	docker logs {{ NATS_NAME }}

# subscribe on local NATS (`just nats-sub`, `just nats-sub --all`, or an institution URN)
[group('NATS')]
nats-sub *args:
	bun run ./src/cli/nats-sub.ts {{ if args == '' { NATS_DEFAULT_INSTITUTION } else { args } }}

# render dev and the per-zone test and prod manifests (no cluster required)
[group('NATS')]
nats-k8s-build:
	#!/usr/bin/env bash
	set -euo pipefail
	if ! diff -q "{{ NATS_USERS }}" "{{ NATS_K8S }}/overlays/dev/nats-users.conf" >/dev/null; then
		echo 'infra/kubernetes/overlays/dev/nats-users.conf drifted from infra/nats/nats-users.conf' >&2
		exit 1
	fi
	kubectl kustomize "{{ NATS_K8S }}/overlays/dev" >/dev/null
	for env in test prod; do
		for zone in bad stg mnz; do
			kubectl kustomize "{{ NATS_K8S }}/overlays/${env}/${zone}" >/dev/null
		done
	done
	echo 'kustomize build ok (dev, test/prod × bad/stg/mnz)'

# apply the three-node dev overlay to the current kubecontext
[group('NATS')]
nats-k8s-dev:
	#!/usr/bin/env bash
	set -euo pipefail
	kubectl apply -k "{{ NATS_K8S }}/overlays/dev"
	kubectl -n eventhub-dev rollout status statefulset/nats
	echo 'NATS nats://127.0.0.1:30422  MQTT mqtt://127.0.0.1:30183  monitor http://127.0.0.1:30822'

# delete the three-node dev overlay
[group('NATS')]
nats-k8s-dev-down:
	kubectl delete -k "{{ NATS_K8S }}/overlays/dev"

# start eventhub-connect (NATS access layer; no ingest env required)
[group('LOCAL')]
connect:
	bun run --hot ./src/connect/index.ts
