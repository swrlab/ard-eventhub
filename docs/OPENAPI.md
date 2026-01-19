# ARD Eventhub / OpenAPI

Die ARD Eventhub-APIs sind im [OpenAPI](https://swagger.io/specification/)-Format dokumentiert (ein standardisiertes, sprachunabhängiges Interface für RESTful APIs). Es wird über [Swagger-UI](https://swagger.io/tools/swagger-ui/) eine testbare Oberfläche unter `{service-endpoint}/openapi/` zur Verfügung bereitgestellt.

Alle Änderungen an der API sollten in [openapi.yaml](https://eventhub-ingest.ard.de/openapi/openapi.yaml) dokumentiert werden; dieses muss anschließend in JSON konvertiert werden.

## YAML nach JSON konvertieren

Nach dem Aktualisieren der OpenAPI-Konfiguration kopiere den Inhalt von `openapi.yaml` in den [Swagger Editor](https://editor.swagger.io/). Wähle `File` -> `Convert and save as JSON` und ersetze die `openapi.json` im Projektverzeichnis.
