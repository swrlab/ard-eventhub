---
title: 'OpenAPI'
description: 'OpenAPI-Spezifikation und API-Referenz.'
deprecated: true
sidebar:
  order: 8
---

Die HTTPS-API des ARD Eventhub ist im [OpenAPI](https://swagger.io/specification/)-Format dokumentiert (ein standardisiertes, sprachunabhängiges Interface für RESTful APIs).

Jede Operation in dieser Spezifikation ist **deprecated**. Login, Events, Subscriptions und Topics bleiben erreichbar, bis der HTTPS-Ingest abgeschaltet wird. Neue Anbindungen laufen über [_Eventhub Connect_](./user/connect-mqtt).

## API-Referenz in diesen Docs

Die Spezifikation aus `openapi.json` wird in diesen Docs als [API-Referenz](/api) gerendert — eine Seite pro Operation, durchsuchbar und in `llms.txt` enthalten.

## Spezifikation pflegen

Request-/Response-Schemas leben als Zod-Schemas unter `src/schemas/`. Path-Metadaten und die Dokument-Assembly liegen in `src/openapi/document.ts`.

Nach Schema- oder Path-Änderungen regenerieren:

```sh
just openapi
```

Das schreibt `openapi.json` via `z.toJSONSchema(..., { target: 'openapi-3.0' })` und formatiert die Datei. Derselbe Befehl regeneriert auch `asyncapi.json` (siehe [AsyncAPI](./asyncapi)).
