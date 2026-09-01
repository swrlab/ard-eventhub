NANOMQ_IMAGE := 'emqx/nanomq:0.24.14'
NANOMQ_NAME := 'eventhub-nanomq'
NANOMQ_CONF := source_directory() / '../infra/nanomq/nanomq.conf'

# start a local NanoMQ hop (Apple container CLI, not docker)
[group('MQTT')]
mqtt-up:
	container run \
		--detach \
		--rm \
		--name {{ NANOMQ_NAME }} \
		--publish 1883:1883 \
		--volume "{{ NANOMQ_CONF }}:/etc/nanomq.conf" \
		--env NANOMQ_ALLOW_ANONYMOUS=true \
		{{ NANOMQ_IMAGE }}

# start NanoMQ with docker (GitHub Actions / Linux)
[group('MQTT')]
mqtt-up-docker:
	#!/usr/bin/env bash
	set -euo pipefail
	docker run \
		--detach \
		--rm \
		--name {{ NANOMQ_NAME }} \
		--publish 1883:1883 \
		--volume "{{ NANOMQ_CONF }}:/etc/nanomq.conf" \
		--env NANOMQ_ALLOW_ANONYMOUS=true \
		{{ NANOMQ_IMAGE }}
	for _ in $(seq 1 30); do
		if bash -c 'echo > /dev/tcp/127.0.0.1/1883' 2>/dev/null; then
			exit 0
		fi
		sleep 1
	done
	echo 'NanoMQ did not listen on 1883' >&2
	exit 1

# stop the local NanoMQ hop
[group('MQTT')]
mqtt-down:
	-container stop {{ NANOMQ_NAME }}

# stop the docker NanoMQ hop
[group('MQTT')]
mqtt-down-docker:
	-docker stop {{ NANOMQ_NAME }}

# restart the hop so retained state is gone
[group('MQTT')]
mqtt-restart: mqtt-down mqtt-up

# stream NanoMQ logs
[group('MQTT')]
mqtt-logs:
	container logs {{ NANOMQ_NAME }}

# subscribe on the local hop (`just mqtt-sub`, `just mqtt-sub --all`, or an institution URN)
[group('MQTT')]
mqtt-sub *args:
	just env "bun run ./src/cli/mqtt-sub.ts {{ if args == '' { 'urn:ard:institution:a3004ff924ece1a2' } else { args } }}"
