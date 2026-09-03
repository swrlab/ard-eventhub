# ARD Eventhub Connect

NATS-native access layer for Eventhub Connect. This process talks to NATS on `:4222`. Publishers still speak MQTT; the NATS MQTT gateway rewrites `inbox/{institutionId}` to `inbox.{institutionId}`.

There is no validation sidecar yet (RFC step 10). `just connect` opens a connection, ensures the `INBOX` and `PLUGINS` JetStream streams plus the durable `sidecar` consumer, and stays up.

Do not put `NATS_URL` on the ingest env module. Connect reads its own vars from [`env.ts`](env.ts).

## Environment

- OPTIONAL `NATS_URL` — default `nats://127.0.0.1:4222`
- OPTIONAL `NATS_USER` / `NATS_PASSWORD` — empty for local anonymous access (later `svc-sidecar`)

Ingest still requires `MQTT_BROKER_URL` and is unchanged. NanoMQ and NATS both bind `:1883` — do not run them at the same time.

## Local NATS (Mac / Homebrew)

```sh
brew install nats-server
brew install nats-io   # optional: `nats` CLI
just mqtt-down         # if NanoMQ is already on 1883
just nats-up
just nats-sub          # one institution (default SWR example URN)
just nats-sub --all    # inbox.>
just connect           # ensure streams, log ready
```

Monitor: `http://127.0.0.1:8222`. Optional CLI: `nats stream ls`, `nats sub 'inbox.>'`.

Pin the Homebrew formula when you need a specific server; recipes assume whatever `nats-server` is on `PATH`.

## Cursor Cloud / remote Linux

Homebrew and Apple `container` are usually missing. Use the official image (same path as CI):

```sh
just mqtt-down-docker   # if a hop already holds 1883
just nats-up-docker
just nats-sub --all
just connect
```

Image: `nats:2.14.6` with [`infra/nats/nats-dev.conf`](../../infra/nats/nats-dev.conf) (JetStream + MQTT `:1883`, no TLS, anonymous).

If docker is also missing, download a pinned `nats-server` binary from [nats-io/nats-server releases](https://github.com/nats-io/nats-server/releases) (for example `v2.14.6`) onto `PATH`, then `just nats-up`. Do not pipe an installer into `sh`.

## Verify both protocols

1. `just nats-sub --all` — NATS-native subscribe on `inbox.>`
2. In another terminal, publish MQTT QoS 1 to `inbox/urn:ard:institution:a3004ff924ece1a2` on `mqtt://127.0.0.1:1883` (or `just mqtt-sub` against this NATS, not NanoMQ)
3. The NATS subscriber prints the payload

Optional: run ingest with the existing `MQTT_BROKER_URL=mqtt://127.0.0.1:1883` so HTTPS posts land on NATS subjects for `just connect` / `just nats-sub` to see.

```sh
just nats-down
# or
just nats-down-docker
```
