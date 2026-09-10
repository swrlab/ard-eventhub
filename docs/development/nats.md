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
just mqtt-down          # NanoMQ belegt ebenfalls :1883
just nats-up            # nats-server auf PATH (Homebrew)
just nats-up-docker     # Cursor Cloud / Linux / CI
just nats-sub --all
just connect
```

Lokale Config: [`infra/nats/nats-dev.conf`](https://github.com/swrlab/ard-eventhub/blob/main/infra/nats/nats-dev.conf) — ein Knoten, JetStream, MQTT `:1883`, ohne TLS. User und bcrypt-Hashes (Klartext `local`) stehen in `nats-users.conf`. Anonyme Connects schlagen fehl. Produktions-Klartext gehört in sops.

Vor einem Reload: `just nats-check`. User hinzufügen, dann `just nats-reload` (kein Restart).

## MQTT nach NATS

| MQTT (Wire) | NATS (Subject) |
| ----------- | -------------- |
| `/`         | `.`            |
| `.`         | `//`           |
| `+`         | `*`            |
| `#`         | `>`            |

Ein Publish auf `inbox.urn:…` über MQTT landet auf `inbox//urn:…` — ein Token, das niemand abonniert. Richtig ist `inbox/urn:…`.

NanoMQ und NATS nicht parallel starten. Ingest-CI bleibt bei NanoMQ; NATS-Tests laufen in einem eigenen Job.
