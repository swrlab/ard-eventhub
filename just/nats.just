NATS_IMAGE := 'nats:2.14.6'
NATS_NAME := 'eventhub-nats'
NATS_CONF := source_directory() / '../infra/nats/nats-dev.conf'
NATS_STORE := source_directory() / '../.local/nats'
NATS_DEFAULT_INSTITUTION := 'urn:ard:institution:a3004ff924ece1a2'

# start a local nats-server (Homebrew / PATH binary). Stop NanoMQ first — both bind :1883.
[group('NATS')]
nats-up:
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
		echo 'port 1883 is in use — stop NanoMQ with `just mqtt-down` so NATS MQTT can bind' >&2
		exit 1
	fi
	mkdir -p "{{ NATS_STORE }}"
	export NATS_JS_STORE="{{ NATS_STORE }}"
	nats-server -c "{{ NATS_CONF }}" >> "{{ NATS_STORE }}/nats-server.log" 2>&1 &
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

# start NATS with docker (Cursor Cloud / Linux / CI). Stop NanoMQ first — both bind :1883.
[group('NATS')]
nats-up-docker:
	#!/usr/bin/env bash
	set -euo pipefail
	if bash -c 'echo > /dev/tcp/127.0.0.1/4222' 2>/dev/null; then
		echo 'NATS already listening on 4222'
		exit 0
	fi
	if bash -c 'echo > /dev/tcp/127.0.0.1/1883' 2>/dev/null; then
		echo 'port 1883 is in use — stop NanoMQ with `just mqtt-down-docker` so NATS MQTT can bind' >&2
		exit 1
	fi
	mkdir -p "{{ NATS_STORE }}"
	docker run \
		--detach \
		--rm \
		--name {{ NATS_NAME }} \
		--publish 4222:4222 \
		--publish 1883:1883 \
		--publish 8222:8222 \
		--volume "{{ NATS_CONF }}:/etc/nats/nats-dev.conf:ro" \
		--volume "{{ NATS_STORE }}:/data" \
		--env NATS_JS_STORE=/data \
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

# start eventhub-connect (NATS access layer; no ingest env required)
[group('LOCAL')]
connect:
	bun run --hot ./src/connect/index.ts
