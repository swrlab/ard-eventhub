# ARD Eventhub Connect

NATS-native access layer for Eventhub Connect. This process talks to NATS on `:4222`. Publishers still speak MQTT; the NATS MQTT gateway rewrites `inbox/{institutionId}` to `inbox.{institutionId}`.

`just dev` opens a connection, ensures the `INBOX` and `PLUGINS` JetStream streams plus the durable validation consumer, and serves the operator UI on `:4173`. The consumer's durable name stays `sidecar`: a new name would create a fresh consumer that replays the whole `INBOX` stream. The same process runs validation ([`validation/`](validation/)): a JetStream pull on `inbox.>`, URN-only zod validation (`creator` required, `created` overwritten with the delivery time first), the subject/payload/feed ownership check, an MQTT RETAIN publish to `radio/{livestreamId}/track/playing` (slashes, because a dot on the MQTT wire becomes `//`), and a NATS fan-out to `plugin.{target}.{livestreamId}.{class}`. Rejections are retained on `feedback/{institutionId}` as `created`, `errors` (the HTTPS API's 400 `errors[]` shape), and the rejected `event`. Every rejection is logged as `validation rejected` with the `cause`, the `errors`, and the full inbox `payload` (decoded JSON, else the text; a prefix past 64 KiB). A schema rejection is logged at error, which is the alert for a bridged event whose body is no longer the URN-only shape (ingest's enriched envelope, with `creator` / `name` / `id`, is that mismatch). Boot is sequential: streams, UI binding, feed, and only once `KV_ARD_FEED` holds a revision validation. Until then the log says `waiting for ard feed in kv` and inbox messages wait in the stream instead of spending the consumer's `max_deliver` budget. A failed publish is nak'd and logged as `validation publish failed` with the `deliveryCount`. `just connect` is the same recipe.

Do not put `NATS_URL` on the ingest env module. Connect reads its own vars from [`env.ts`](env.ts).

Users live in [`components/users/nats-users.conf`](../../infra/kubernetes/components/users/nats-users.conf) (RFC §7). [`infra/nats/nats-users.conf`](../../infra/nats/nats-users.conf) is a symlink to that file. Publishers and services share one bcrypt hash (`$DEV_PW`). The plaintext password is only in sops. `sub-ui` has no password. Rotate a publisher by issuing a new `pub-{label}-{date}` user, then `just nats-reload`. Hash a password with `just nats-passwd`.

## Environment

- OPTIONAL `NATS_URL` — default `nats://127.0.0.1:4222`. Server address only. A user or password in the URL is ignored and stripped before anything is logged. `just env` injects it from sops.
- OPTIONAL `NATS_USER` / `NATS_PASSWORD` — login for that server and for the MQTT gateway. `just env` injects them from sops. Empty means no credentials. The JS client wants `user` / `pass` options, so connect passes these through and logs only the host.
- OPTIONAL `NATS_MQTT_URL` — MQTT gateway for retained `radio/` and `feedback/` publishes. Default is the `NATS_URL` host on port `1883`. Validation authenticates with `NATS_USER` and `NATS_PASSWORD`. Set `POD_NAME` when more than one connect process runs, so each MQTT client id stays unique.
- OPTIONAL `ARD_FEED_URL` — ARD core livestream feed. `just env` injects it from sops. Unset, the process never downloads and serves whatever another process wrote to KV. With an empty bucket too, validation does not start.

### ARD feed

The JetStream bucket `KV_ARD_FEED` (subject `$KV.ARD_FEED.livestreams`) holds the latest feed. Every connect process watches it, so a write by any one of them reaches all of them.

1. **Boot.** Read the latest revision from KV. Only when the bucket is empty, download `ARD_FEED_URL` and write it. Validation starts once a revision is serving.
2. **Refresh.** `POST /api/update-feed` downloads again and writes a newer document to KV. A Kubernetes CronJob calls it hourly (manifest not in this tree yet). The endpoint takes no body. It answers with the `/api/feed` report: `200` when stored or unchanged, `502` when the fetch failed or the document was rejected, `503` without NATS. Concurrent calls share one download.
3. **Read.** [`feed/current-feed.ts`](feed/current-feed.ts) holds the serving revision in memory. `currentFeed()`, `currentOwners()`, and `currentFeedReport()` are synchronous. Only KV revisions are written into it.

A failed fetch, a malformed body, a dropped institution count, a missing connected institution, or a `generatedAt` that is not newer leaves the previous revision serving. `/api/feed` reports the age of this process's last successful fetch (`warn` at 3h, `alert` at 12h, `page` at 48h). The feed page shows when the snapshot was built and when it was last fetched.

`svc-eventhub-connect` publishes `$KV.ARD_FEED.>` and subscribes to `feedback.>` for the rejection board. A cluster that is already running needs that users file reapplied (`just nats-reload` locally, or a config reload on the dev cluster) before the first write succeeds. Trigger a refresh locally with `curl -X POST http://127.0.0.1:4173/api/update-feed`.

Ingest dual-writes only when `MQTT_BROKER_URL` is set. Put the user and password in that URL (`mqtt://user:password@host:1883`). The plaintext is only in sops. Unset, ingest stays on Pub/Sub. The local broker's MQTT listener is `:1883`. Anonymous connects are rejected (`no_auth_user` is unset).

## Local NATS (Mac / Homebrew)

```sh
brew install nats-server
brew install nats-io   # optional: `nats` CLI
just nats-up
just nats-sub          # one institution (default SWR example URN)
just nats-sub --all    # inbox.>
just ui-build
just dev               # ensure streams, serve the operator UI on :4173
```

Monitor: `http://127.0.0.1:8222`. Optional CLI: `nats stream ls`, `nats sub 'inbox.>'`.

## Operator UI

The same process serves the boards. Stats are plain HTTP, polled every 8 seconds. The live tail is not that process: the page opens a NATS WebSocket (`ws://` port 9222, or `NATS_WS_URL`) as `sub-ui` with no password and subscribes to `radio.>`. Publishing still requires a username and password. Vite writes `static/dist` (manifest plus hashed assets), and connect serves that the way a built frontend is served: `/static/*` from the repo root, and every other GET returns the HTML shell.

```sh
just ui-build
just dev
# http://127.0.0.1:4173
```

Hot reload: `USE_HMR=true just dev` in one terminal and `just ui` in another. The page stays on `:4173`. Its script tag points at the Vite server on `:5173`. `USE_HMR=dev` is only for the Vite `base` when you want absolute dev-server URLs inside the build.

The process connects as `NATS_USER` (local sops uses `svc-eventhub-connect`) with `NATS_PASSWORD`, the same login that ensures streams. Cluster and connection stats use the HTTP monitor. The tail does not use that login. The page connects as `sub-ui` with no password, WebSocket only, and may subscribe to `radio.>` only. A cluster that is already running needs the users file and the `websocket` listener reapplied before that works. The UI never sends a password to the browser.

Panels:

- **On-air.** Last retained message per `radio.{livestream}`, oldest last-event first.
- **Feed.** The snapshot this process is authorizing with, plus the `allowed-livestreams.json` overlay, as one list (`knownLivestreams`). A feed row's id is the item `externalId`, the livestream URN publishers send, not the fusion id. Overlay rows are topics absent from the core feed. They add a publish permission: `publisherId` must match, and the institution is still that publisher's house in the feed. The livestream title opens that station's tail.
- **Connections.** Users from `NATS_USERS_CONF` (default `infra/kubernetes/components/users/nats-users.conf`) plus `/connz`. Usernames and allow-lists only.
- **Rejections.** Retained `feedback.>` plus what arrived while this process was up. `?institution=` filters one house. Each row expands to the rejected event as JSON.
- **Cluster.** `/varz`, `/connz`, `/jsz`, sampled until each node behind the monitor URL has answered.
- **Tail.** Default filter `radio.*.track.playing`. The browser opens NATS WebSocket as `sub-ui` (no password) and subscribes itself. Closes after 2 minutes with no click, key, or scroll, and after 30 minutes even if someone is still there. Over 20 frames/s the page drops frames and shows `sampled`. Reopening is a click.

`UI_HOST` (default `0.0.0.0`), `UI_PORT` (default `4173`). `UI_ALLOW_CIDR` is a comma-separated source list checked against the socket address. Empty allows every peer, which is the local default. Set it when the UI is reachable on a shared network.

Tail limits are also in the page footer.

Pin the Homebrew formula when you need a specific server; recipes assume whatever `nats-server` is on `PATH`.

## Cursor Cloud / remote Linux

Homebrew and Apple `container` are usually missing. Use the official image (same path as CI):

```sh
just nats-up-docker
just nats-sub --all
just dev
```

Image: `nats:2.14.6` with [`infra/nats/nats-dev.conf`](../../infra/nats/nats-dev.conf) (JetStream + MQTT `:1883`, no TLS, users from `nats-users.conf`).

Kubernetes: dev runs three NATS pods in one cluster. Test and prod are one manifest per zone. See [`infra/kubernetes/README.md`](../../infra/kubernetes/README.md) (`just nats-k8s-dev`).

Validate config before reload: `just nats-check`. After editing `.local/nats/nats-users.conf`, `just nats-reload` (HUP) picks up users without dropping connections. Hash a new password with `just nats-passwd`.

If docker is also missing, download a pinned `nats-server` binary from [nats-io/nats-server releases](https://github.com/nats-io/nats-server/releases) (for example `v2.14.6`) onto `PATH`, then `just nats-up`. Do not pipe an installer into `sh`.

## Verify both protocols

1. `just nats-sub --all` — NATS-native subscribe on `inbox.>`
2. In another terminal, publish MQTT QoS 1 as `pub-swr-2026-06-26` and the sops password to `inbox/urn:ard:institution:a3004ff924ece1a2` on `mqtt://127.0.0.1:1883`
3. The NATS subscriber prints the payload

Optional: run ingest with `MQTT_BROKER_URL=mqtt://127.0.0.1:1883` and NATS up so HTTPS posts land on NATS subjects for `just dev` / `just nats-sub` to see. Ingest publishes as `svc-ingest`.

```sh
just nats-down
# or
just nats-down-docker
```
