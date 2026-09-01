---
title: 'AsyncAPI'
description: 'AsyncAPI-Spezifikation für Eventhub Connect (MQTT).'
sidebar:
  order: 9
---

Eventhub Connect (MQTT) ist im [AsyncAPI](https://www.asyncapi.com/docs/reference/specification/v3.0.0)-Format dokumentiert.

## Events-Referenz in diesen Docs

Die Spezifikation aus `asyncapi.json` wird in diesen Docs als [Events-Referenz](/events) gerendert — eine Seite pro `send`/`receive`-Operation.

Aktuell sind das die Connect-Klassen `radio.control` und `radio.data`. Sie sind **nicht** über `POST /events` erreichbar. Der MQTT-Broker ist noch nicht im Betrieb; Host und Zugangsdaten in der Spezifikation sind Platzhalter.

Die Payload-Schemas stammen aus denselben Zod-Definitionen wie die OpenAPI-Komponenten. MQTT-Bindings (QoS, Retain) kommen aus dem [v3 Connect RFC](https://swrlab.github.io/ard-eventhub/context-rfc/eventhub-v3-connect#13-new-event-schemas).

## Spezifikation pflegen

Nach Schema- oder Kanal-Änderungen regenerieren:

```sh
just asyncapi
```

`just openapi` ruft das mit auf. Das schreibt `asyncapi.json` via `z.toJSONSchema(..., { target: 'draft-7' })` und formatiert die Datei.
