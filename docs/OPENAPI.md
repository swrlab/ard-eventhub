# ARD Eventhub / OpenAPI

The ARD Eventhub APIs are documented with [OpenAPI](https://swagger.io/specification/) specification (a standard, language-agnostic interface to RESTful APIs). With [Swagger-UI](https://swagger.io/tools/swagger-ui/) a testable interface is provided at `{service-endpoint}/openapi/`.

All changes in the API should be documented in [openapi.yaml](https://eventhub-ingest.ard.de/openapi/openapi.yaml) which must be converted to a JSON format afterwards.

## Convert YAML to JSON

After updating the OpenAPI configuration, copy the content of `openapi.yaml` and paste it to the [Swagger Editor](https://editor.swagger.io/). Select `File` -> `Convert and save as JSON` and replace the `openapi.json` in project root.
