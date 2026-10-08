---
title: 'NATS lokal'
description: 'Lokaler NATS-Broker mit JetStream und MQTT-Gateway für Eventhub Connect.'
sidebar:
  order: 12
---

Eventhub Connect spricht NATS-nativ (`:4222`). Publisher bleiben bei MQTT; das MQTT-Gateway schreibt `inbox/{institutionId}` nach `inbox.{institutionId}` um.

Die vollständige Einrichtungsanleitung (Homebrew, Cursor Cloud, Docker) steht in [`src/connect/README.md`](https://github.com/swrlab/ard-eventhub/blob/main/src/connect/README.md).

## Kurzbefehle

```sh
just nats-up            # nats-server auf PATH (Homebrew)
just nats-up-docker     # Cursor Cloud / Linux / CI
just nats-sub --all
just ui-build
just dev            # streams plus the operator UI, http://127.0.0.1:4173
```

## Operator UI

`just dev` serves the boards after `just ui-build`. On-air, connections, rejections, and cluster health poll HTTP every 8 seconds. The live tail is a NATS WebSocket on port 9222, username `sub-ui`, no password, subscribe `radio.>` only. It closes after 2 minutes without a click, key, or scroll, and after 30 minutes regardless. A hidden tab does not keep it open.

The boards use the connect login (the user in `NATS_URL`, `svc-sidecar` locally). The tail uses `sub-ui` with no password. Set `NATS_WS_URL` when the WebSocket listener is not `ws://` plus the NATS host on port 9222. Passwords are not shown. Vite hot reload is `USE_HMR=true just dev` plus `just ui`. The feed board lists the serving snapshot, plus `allowed-livestreams.json` rows that add a publish permission for topics absent from the core feed. It shows when that snapshot was built and when this process last fetched it. A livestream title opens that station's tail. Feed ids are the item `externalId`, not the fusion id. Connect pulls `ARD_FEED_URL` into `KV_ARD_FEED` hourly. A bad fetch keeps the previous KV or disk snapshot.

Lokale Config: [`infra/nats/nats-dev.conf`](https://github.com/swrlab/ard-eventhub/blob/main/infra/nats/nats-dev.conf) — ein Knoten, JetStream, MQTT `:1883`, WebSocket `:9222` ohne TLS. User und bcrypt-Hashes (Klartext `local`) stehen in [`components/users/nats-users.conf`](https://github.com/swrlab/ard-eventhub/blob/main/infra/kubernetes/components/users/nats-users.conf). `sub-ui` hat kein Passwort. `infra/nats/nats-users.conf` ist ein Symlink darauf. Anonyme Connects schlagen fehl.

Vor einem Reload: `just nats-check`. User hinzufügen, dann `just nats-reload` (kein Restart).

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

Dev fährt drei NATS-Pods in einem Cluster. Test und prod haben je eine Config pro Zone (bad, stg, mnz): [`infra/kubernetes/README.md`](https://github.com/swrlab/ard-eventhub/blob/main/infra/kubernetes/README.md).

```sh
just nats-k8s-dev
```
