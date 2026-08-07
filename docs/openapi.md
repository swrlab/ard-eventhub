---
title: "OpenAPI"
description: "OpenAPI-Spezifikation und API-Referenz."
sidebar:
  order: 8
---

Die ARD Eventhub-APIs sind im [OpenAPI](https://swagger.io/specification/)-Format dokumentiert (ein standardisiertes, sprachunabhängiges Interface für RESTful APIs).

## API-Referenz in diesen Docs

Die Spezifikation aus `openapi.yaml` wird in diesen Docs als [API-Referenz](/api) gerendert — eine Seite pro Operation, durchsuchbar und in `llms.txt` enthalten.

## Spezifikation pflegen

Alle Änderungen an der API sollten in `openapi.yaml` im Projektverzeichnis dokumentiert werden; dieses muss anschließend in JSON konvertiert werden.

### YAML nach JSON konvertieren

Nach dem Aktualisieren der OpenAPI-Konfiguration kopiere den Inhalt von `openapi.yaml` in den [Swagger Editor](https://editor.swagger.io/). Wähle `File` -> `Convert and save as JSON` und ersetze die `openapi.json` im Projektverzeichnis.
