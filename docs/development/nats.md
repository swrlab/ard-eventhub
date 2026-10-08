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
just connect            # streams plus the operator UI, http://127.0.0.1:4173
```

## Operator UI

`just connect` serves the boards after `just ui-build`. On-air, connections, rejections, and cluster health poll HTTP every 8 seconds. The live tail is a separate WebSocket: it closes after 2 minutes without a click, key, or scroll, and after 30 minutes regardless. A hidden tab does not keep it open. Dev cluster:

```sh
NATS_MONITOR_URL=http://leno0:8222 NATS_URL=nats://leno0:4222 just connect
```

The UI uses the connect login (`NATS_USER`, default `svc-sidecar`). `svc-operator` can subscribe to radio and feedback once that user is on the cluster. Passwords are not shown. Vite hot reload is `USE_HMR=true just connect` plus `just ui`.

Lokale Config: [`infra/nats/nats-dev.conf`](https://github.com/swrlab/ard-eventhub/blob/main/infra/nats/nats-dev.conf) — ein Knoten, JetStream, MQTT `:1883`, ohne TLS. User und bcrypt-Hashes (Klartext `local`) stehen in [`components/users/nats-users.conf`](https://github.com/swrlab/ard-eventhub/blob/main/infra/kubernetes/components/users/nats-users.conf). `infra/nats/nats-users.conf` ist ein Symlink darauf. Anonyme Connects schlagen fehl.

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
