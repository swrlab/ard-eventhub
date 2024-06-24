# ARD-Eventhub / Stages

The Eventhub differentiates between stages given to the service via env `STAGE` and different runtime environments or deployments, such as beta, test, or similar.

## Ingest

### Ingest Service Stages

| Module / Stage | `dev`                 | `test`                 | `prod`                 |
| -------------- | --------------------- | ---------------------- | ---------------------- |
| Database       | Namespace `dev`       | Namespace `test`       | Namespace `prod`       |
| Pub/Sub        | Prefix includes `dev` | Prefix includes `test` | Prefix includes `prod` |
| Dev Logging    | true                  | true                   | false                  |

### Ingest Deployment Stages

| Module / Stage               | `dev`                        | `test`                              | `beta`                        | `prod`                   |
| ---------------------------- | ---------------------------- | ----------------------------------- | ----------------------------- | ------------------------ |
| Used Ingest Stage            | `dev`                        | `test`                              | `prod`                        | `prod`                   |
| Stable                       | No, used for internal tests  | Yes, can be used for external tests | Yes, usually                  | Yes                      |
| Runtime                      | Cloud Run                    | Kubernetes                          | Kubernetes                    | Kubernetes               |
| Container Registry           | Eventhub project             | Eventhub project                    | Eventhub project              | Eventhub project         |
| Host                         | For internal use only        | `eventhub-ingest-test.ard.de`       | `eventhub-ingest-beta.ard.de` | `eventhub-ingest.ard.de` |
| Automatic Deployment         | Yes, with Github Actions     | Yes, through API with Review        | Yes, through API with Review  | No, manual trigger       |
| Deployment Branch Protection | `main`, `dev/*`, `feature/*` | `main`                              | `main`                        | `main`                   |
