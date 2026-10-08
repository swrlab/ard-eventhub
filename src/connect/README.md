# ARD Eventhub Connect

NATS-native access layer for Eventhub Connect. This process talks to NATS on `:4222`. Publishers still speak MQTT; the NATS MQTT gateway rewrites `inbox/{institutionId}` to `inbox.{institutionId}`.

There is no validation sidecar yet (RFC step 10). `just connect` opens a connection, ensures the `INBOX` and `PLUGINS` JetStream streams plus the durable `sidecar` consumer, and stays up.

Do not put `NATS_URL` on the ingest env module. Connect reads its own vars from [`env.ts`](env.ts).

Users live in [`components/users/nats-users.conf`](../../infra/kubernetes/components/users/nats-users.conf) (RFC §7). [`infra/nats/nats-users.conf`](../../infra/nats/nats-users.conf) is a symlink to that file. It holds one bcrypt hash (`$DEV_PW`) of the well-known password `local` (not a secret). Rotate by issuing a new `pub-{label}-{date}` user, then `just nats-reload`. Hash a password with `just nats-passwd`.

## Environment

- OPTIONAL `NATS_URL` — default `nats://127.0.0.1:4222`
- OPTIONAL `NATS_USER` — default `svc-sidecar`
- OPTIONAL `NATS_PASSWORD` — default `local` (override via sops in deployed environments)

Ingest dual-writes only when `MQTT_BROKER_URL` is set, as `svc-ingest` / `MQTT_PASSWORD` (default `local`). Unset, ingest stays on Pub/Sub. The local broker's MQTT listener is `:1883`. Anonymous connects are rejected (`no_auth_user` is unset).

## Local NATS (Mac / Homebrew)

```sh
brew install nats-server
brew install nats-io   # optional: `nats` CLI
just nats-up
just nats-sub          # one institution (default SWR example URN)
just nats-sub --all    # inbox.>
just connect           # ensure streams, log ready
```

Monitor: `http://127.0.0.1:8222`. Optional CLI: `nats stream ls`, `nats sub 'inbox.>'`.

## Operator UI

Read-only boards for the broker. Stats are plain HTTP, polled every 8 seconds. The live tail is the only WebSocket, and it is not a monitoring feed.

```sh
just ui-build
just connect-ui
# http://127.0.0.1:4173
```

`just ui` runs Vite on `:5173` and proxies `/api` to `:4173`.

Dev cluster (three pods behind one monitor URL):

```sh
NATS_MONITOR_URL=http://leno0:8222 NATS_URL=nats://leno0:4222 just connect-ui
```

The process connects as `svc-operator` (subscribe `radio.>`, `feedback.>`, `inbox.>`, `plugin.>`; publish only `$JS.API` and `_INBOX`). `just nats-up` picks the user up from `infra/kubernetes/components/users/nats-users.conf`. A cluster that is already running needs that file reapplied before `svc-operator` exists. Until then set `NATS_USER=svc-sidecar`. Cluster and connection stats use the HTTP monitor and do not need this login. The UI never sends the password to the browser.

Panels:

- **On-air.** Last retained message per `radio.{livestream}`, oldest last-event first.
- **Connections.** Users from `NATS_USERS_CONF` (default `infra/kubernetes/components/users/nats-users.conf`) plus `/connz`. Usernames and allow-lists only.
- **Rejections.** Retained `feedback.>` plus what arrived while this process was up. `?institution=` filters one house.
- **Cluster.** `/varz`, `/connz`, `/jsz`, sampled until each node behind the monitor URL has answered.
- **Tail.** Default filter `radio.*.track.playing`. Closes after 2 minutes with no presence beat, and after 30 minutes even if someone is still there. At most 8 tails on this process. Over 20 frames/s the tail drops and shows `sampled`. Reopening is a click.

`UI_HOST` (default `0.0.0.0`), `UI_PORT` (default `4173`). `UI_ALLOW_CIDR` is a comma-separated source list checked against the socket address. Empty allows every peer, which is the local default. Set it when the UI is reachable on a shared network.

Tail limits are also in the page footer.

Pin the Homebrew formula when you need a specific server; recipes assume whatever `nats-server` is on `PATH`.

## Cursor Cloud / remote Linux

Homebrew and Apple `container` are usually missing. Use the official image (same path as CI):

```sh
just nats-up-docker
just nats-sub --all
just connect
```

Image: `nats:2.14.6` with [`infra/nats/nats-dev.conf`](../../infra/nats/nats-dev.conf) (JetStream + MQTT `:1883`, no TLS, users from `nats-users.conf`).

Kubernetes: dev runs three NATS pods in one cluster. Test and prod are one manifest per zone. See [`infra/kubernetes/README.md`](../../infra/kubernetes/README.md) (`just nats-k8s-dev`).

Validate config before reload: `just nats-check`. After editing `.local/nats/nats-users.conf`, `just nats-reload` (HUP) picks up users without dropping connections. Hash a new password with `just nats-passwd`.

If docker is also missing, download a pinned `nats-server` binary from [nats-io/nats-server releases](https://github.com/nats-io/nats-server/releases) (for example `v2.14.6`) onto `PATH`, then `just nats-up`. Do not pipe an installer into `sh`.

## Verify both protocols

1. `just nats-sub --all` — NATS-native subscribe on `inbox.>`
2. In another terminal, publish MQTT QoS 1 as `pub-swr-2026-06-26` / `local` to `inbox/urn:ard:institution:a3004ff924ece1a2` on `mqtt://127.0.0.1:1883`
3. The NATS subscriber prints the payload

Optional: run ingest with `MQTT_BROKER_URL=mqtt://127.0.0.1:1883` and NATS up so HTTPS posts land on NATS subjects for `just connect` / `just nats-sub` to see. Ingest publishes as `svc-ingest`.

```sh
just nats-down
# or
just nats-down-docker
```
