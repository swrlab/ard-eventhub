# ARD Eventhub / OpenAPI

Die ARD Eventhub-APIs sind im [OpenAPI](https://swagger.io/specification/)-Format dokumentiert (ein standardisiertes, sprachunabhängiges Interface für RESTful APIs). Es wird über [Swagger-UI](https://swagger.io/tools/swagger-ui/) eine testbare Oberfläche unter `{service-endpoint}/openapi/` zur Verfügung bereitgestellt.

Alle Änderungen an der API sollten in den Zod-Schemas unter `src/ingest/schemas/` dokumentiert werden. Anschließend die OpenAPI-Dateien neu generieren:

```bash
bun run openapi:generate
bun run openapi:format
```

Die generierten Dateien `openapi.json` und `openapi.yaml` im Projektverzeichnis sind die veröffentlichte API-Spezifikation.
