# ARD Eventhub Connect

NATS-native access layer for Eventhub Connect. This process talks to NATS on `:4222`. Publishers still speak MQTT; the NATS MQTT gateway rewrites `inbox/{institutionId}` to `inbox.{institutionId}`.

There is no validation sidecar yet (RFC step 10). `just connect` opens a connection, ensures the `INBOX` and `PLUGINS` JetStream streams plus the durable `sidecar` consumer, and stays up.

Do not put `NATS_URL` on the ingest env module. Connect reads its own vars from [`env.ts`](env.ts).

Local users live in [`infra/nats/nats-users.conf`](../../infra/nats/nats-users.conf) (RFC §7). The file holds one bcrypt hash (`$DEV_PW`) of the well-known password `local` (not a secret). Production plaintext belongs in sops; rotate by issuing a new `pub-{label}-{date}` user, then `just nats-reload`. Hash a password with `just nats-passwd`.

## Environment

- OPTIONAL `NATS_URL` — default `nats://127.0.0.1:4222`
- OPTIONAL `NATS_USER` — default `svc-sidecar`
- OPTIONAL `NATS_PASSWORD` — default `local` (override via sops in deployed environments)

Ingest dual-writes only when `MQTT_BROKER_URL` is set. Unset, ingest stays on Pub/Sub. NanoMQ and NATS both bind `:1883` — do not run them at the same time. Anonymous NATS/MQTT connects are rejected (`no_auth_user` is unset).

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

Image: `nats:2.14.6` with [`infra/nats/nats-dev.conf`](../../infra/nats/nats-dev.conf) (JetStream + MQTT `:1883`, no TLS, users from `nats-users.conf`).

Validate config before reload: `just nats-check`. A broken file is rejected by `just nats-check-invalid` and must not be reloaded onto a running server. After editing `.local/nats/nats-users.conf`, `just nats-reload` (HUP) picks up users without dropping connections. Hash a new password with `just nats-passwd`.

If docker is also missing, download a pinned `nats-server` binary from [nats-io/nats-server releases](https://github.com/nats-io/nats-server/releases) (for example `v2.14.6`) onto `PATH`, then `just nats-up`. Do not pipe an installer into `sh`.

## Verify both protocols

1. `just nats-sub --all` — NATS-native subscribe on `inbox.>`
2. In another terminal, publish MQTT QoS 1 as `pub-swr-2026-06-26` / `local` to `inbox/urn:ard:institution:a3004ff924ece1a2` on `mqtt://127.0.0.1:1883`
3. The NATS subscriber prints the payload

Optional: run ingest with the existing `MQTT_BROKER_URL=mqtt://127.0.0.1:1883` so HTTPS posts land on NATS subjects for `just connect` / `just nats-sub` to see. The GCP→CN hop is `just bridge` ([`../bridge/README.md`](../bridge/README.md)) — it needs the NanoMQ hop and NATS on **different** hosts because both default to `:1883`.

```sh
just nats-down
# or
just nats-down-docker
```
