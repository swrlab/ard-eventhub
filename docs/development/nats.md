---
title: 'NATS lokal'
description: 'Lokaler NATS-Broker mit JetStream und MQTT-Gateway für Eventhub Connect.'
sidebar:
  order: 12
---

## Role

NATS is the broker Eventhub Connect runs on. It carries live radio metadata between publishers, subscribers, and the connect process. Publishers stay on MQTT. The server's built-in gateway rewrites those topics into NATS subjects, and JetStream holds sessions, retained messages, and key-value data such as the ARD feed. Connect speaks the native client protocol. Eventhub runs the upstream server.

NATS is an open-source system for connecting distributed services. Core NATS provides publish/subscribe and request/reply. JetStream adds durable streams and key-value. Synadia donated the project to the [Cloud Native Computing Foundation](https://www.cncf.io/projects/nats/) (CNCF) in 2018, which hosts it as an incubating project under vendor-neutral governance. It is widely used in production across industries.

## Kurzbefehle

```sh
just nats-up            # nats-server auf PATH (Homebrew)
just nats-up-docker     # Cursor Cloud / Linux / CI; publishes :4222, :1883, :8222, :9222
just nats-sub --all
just ui-build
just dev            # streams plus the operator UI, http://127.0.0.1:4173
```

## Operator UI

`just dev` serves the boards after `just ui-build`. On-air, connections, rejections, and cluster health poll HTTP every 8 seconds. The live tail is a NATS WebSocket on port 9222, username `sub-ui`, no password, subscribe `radio.>` only. `just nats-up` binds that listener on the host. `just nats-up-docker` publishes it, so a browser on the host can open the tail. The filter box takes an MQTT topic (`radio/+/track/playing` by default). The page subscribes the NATS subject and shows that subject under the field. It closes after 2 minutes without a click, key, or scroll, and after 30 minutes regardless. A hidden tab does not keep it open.

The boards use the connect login (`NATS_USER`, `svc-eventhub-connect` locally, password in `NATS_PASSWORD`). The tail uses `sub-ui` with no password. Set `NATS_WS_URL` when the WebSocket listener is not `ws://` plus the NATS host on port 9222. Passwords are not shown. Vite hot reload is `USE_HMR=true just dev` plus `just ui`. The feed board lists the serving snapshot, plus `allowed-livestreams.json` rows that add a publish permission for topics absent from the core feed. It shows when that snapshot was built and when this process last fetched it. A livestream title opens that station's tail. Feed ids are the item `externalId`, not the fusion id. Connect reads `KV_ARD_FEED` on boot, downloads `ARD_FEED_URL` only when the bucket is empty, and refreshes it on `POST /api/update-feed` (hourly CronJob). A bad fetch keeps the previous KV revision.

Lokale Config: [`infra/nats/nats-dev.conf`](https://github.com/swrlab/ard-eventhub/blob/main/infra/nats/nats-dev.conf) — ein Knoten, JetStream, MQTT `:1883`, WebSocket `:9222` ohne TLS. User und bcrypt-Hashes stehen in [`components/users/nats-users.conf`](https://github.com/swrlab/ard-eventhub/blob/main/infra/kubernetes/components/users/nats-users.conf). Das Passwort liegt nur in sops. `sub-ui` hat kein Passwort. `infra/nats/nats-users.conf` ist ein Symlink darauf. Anonyme Connects schlagen fehl.

Vor einem Reload: `just nats-check`. User hinzufügen, dann `just nats-reload` (kein Restart).

## MCP

The connect process serves MCP at `/mcp`. `cluster` is the cluster board. `on-air` is the latest retained state for a publisher or institution, read from the connection and feed this process is already serving. Cursor points at `http://127.0.0.1:4173/mcp` from `.cursor/mcp.json`. `just dev` has to be running.

## MQTT nach NATS

| MQTT (Wire) | NATS (Subject) |
| ----------- | -------------- |
| `/`         | `.`            |
| `.`         | `//`           |
| `+`         | `*`            |
| `#`         | `>`            |

Ein Publish auf `inbox.urn:…` über MQTT landet auf `inbox//urn:…` — ein Token, das niemand abonniert. Richtig ist `inbox/urn:…`.

Ingest publiziert bei gesetztem `MQTT_BROKER_URL` direkt auf das Gateway als `svc-ingest`. Ingest-CI startet dafür NATS (`just nats-up-docker`). Die `svc-ingest`-ACL prüft der eigene NATS-Job.

## Kubernetes

Dev fährt drei NATS-Pods in einem Cluster. Test und prod haben je eine Config pro Zone (bad, stg, mnz): [`infra/kubernetes/README.md`](https://github.com/swrlab/ard-eventhub/blob/main/infra/kubernetes/README.md). Zertifikat erzeugen und als Secret `nats-tls` auf jeden Zonen-Cluster legen: [Certificates](./certificates).

```sh
just nats-k8s-dev
```
