---
title: 'AsyncAPI'
description: 'AsyncAPI-Spezifikation für Eventhub Connect (MQTT).'
sidebar:
  order: 9
---

Eventhub Connect (MQTT) ist im [AsyncAPI](https://www.asyncapi.com/docs/reference/specification/v3.0.0)-Format dokumentiert.

## Events-Referenz in diesen Docs

Die Spezifikation aus `asyncapi.json` wird in diesen Docs als [Events-Referenz](/events) gerendert — eine Seite pro `send`/`receive`-Operation.

Publisher schreiben `track.playing`, `track.next`, `radio.control` und `radio.data` auf `inbox/{institutionId}`. Subscriber lesen die zugestellte Fassung auf `radio/{livestreamId}/track/playing`, `…/track/next`, `…/control` und `…/data`. Ablehnungen stehen retained auf `feedback/{institutionId}`. `radio.control` und `radio.data` lehnt `POST /events` mit HTTP 400 ab; Track-Events nimmt der HTTPS-Ingest während der Migration noch an. Das Protokoll ist MQTT 3.1.1 auf TLS-Port `8883`; ein v5-Connect wird abgelehnt. Host `connect.eventhub.invalid` in der Spezifikation ist ein Platzhalter. Die drei Knotennamen, die Zugangsdaten und ein lauffähiges Beispiel stehen unter [_Eventhub Connect_](./user/connect-mqtt).

Jede Klasse hat eine eigene Erläuterung. Dieselbe Adresse hängt als `externalDocs` an der jeweiligen `send`- und `receive`-Operation:

- [_de.ard.eventhub.v1.radio.track.playing_](./event/radio.track.playing)
- [_de.ard.eventhub.v1.radio.track.next_](./event/radio.track.next)
- [_de.ard.eventhub.v1.radio.control_](./event/radio.control)
- [_de.ard.eventhub.v1.radio.data_](./event/radio.data)

`radio.control` und `radio.data` nutzen dieselben Zod-Schemas wie die OpenAPI-Komponenten. Track-Events nutzen die URN-only Inbox-Form (`creator`, von der Eventhub Validierung gesetztes `created`, `services[]` ohne CRID). Das Feedback-Schema ist der Body, den die Eventhub Validierung auf `feedback/` ablegt. MQTT-Bindings (QoS, Retain) kommen aus dem [v3 Connect RFC](https://swrlab.github.io/ard-eventhub/context-rfc/eventhub-v3-connect#62-topic-tree).

## Spezifikation pflegen

Nach Schema- oder Kanal-Änderungen regenerieren:

```sh
just asyncapi
```

`just openapi` ruft das mit auf. Das schreibt `asyncapi.json` via `z.toJSONSchema(..., { target: 'draft-7' })` und formatiert die Datei.
