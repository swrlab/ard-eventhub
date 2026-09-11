---
title: 'Eventhub Bridge'
description: 'GCP-MQTT nach CN-MQTT: ein Relay-Prozess, eine Instanz.'
sidebar:
  order: 13
---

`eventhub-bridge` ist ein dummer Relay: Subscribe auf dem GCP-/NanoMQ-Hop `inbox/#`, Publish unveränderter Topic+Bytes auf das CN-MQTT-Gateway als `svc-bridge` — derselbe Weg wie ein migrierter Publisher.

Einrichtung und Variablen stehen in [`src/bridge/README.md`](https://github.com/swrlab/ard-eventhub/blob/main/src/bridge/README.md).

## Kurzbefehle

```sh
just mqtt-up            # Hop :1883 — nicht zusammen mit NATS
just nats-up            # CN MQTT :1883 — anderer Host, wenn der Hop lokal läuft
just bridge
```

Eine Instanz reicht — zwei Relays verdoppeln jedes Event. Der Prozess darf auf jedem Knoten laufen. GCP-`clientId` `eventhub-bridge`. Aus: nicht deployen, nicht starten.

Lag erscheint im Log als `bridge lag` (`lagMs` seit dem letzten Relay).
