# ARD Eventhub / Stages

Der Eventhub unterscheidet zwischen dem über die Umgebungsvariable `STAGE` gesetzten Stage-Wert und verschiedenen Laufzeit-Umgebungen bzw. Deployments (z.B. `beta`, `test`, `prod`).

## Ingest

### Ingest Service Stages

| Module / Stage | `dev`                 | `test`                 | `prod`                 |
| -------------- | --------------------- | ---------------------- | ---------------------- |
| Database       | Namespace `dev`       | Namespace `test`       | Namespace `prod`       |
| Pub/Sub        | Prefix enthält `dev`  | Prefix enthält `test`  | Prefix enthält `prod`  |
| Dev Logging    | true                  | true                   | false                  |

### Ingest Deployment Stages

| Module / Stage               | `dev`                        | `test`                              | `beta`                        | `prod`                   |
| ---------------------------- | ---------------------------- | ----------------------------------- | ----------------------------- | ------------------------ |
| Used Ingest Stage            | `dev`                        | `test`                              | `prod`                        | `prod`                   |
| Stable                       | Nein, für interne Tests      | Ja, für externe Tests geeignet      | Ja, normalerweise             | Ja                      |
| Runtime                      | Cloud Run                    | Kubernetes                          | Kubernetes                    | Kubernetes               |
| Container Registry           | Eventhub-Projekt             | Eventhub-Projekt                    | Eventhub-Projekt              | Eventhub-Projekt         |
| Host                         | Nur für internen Gebrauch    | `eventhub-ingest-test.ard.de`       | `eventhub-ingest-beta.ard.de` | `eventhub-ingest.ard.de` |
| Automatic Deployment         | Ja, via Github Actions      | Ja, über API mit Review             | Ja, über API mit Review       | Nein, manueller Trigger  |
| Deployment Branch Protection | `main`, `dev/*`, `feature/*` | `main`                              | `main`                        | `main`                   |
