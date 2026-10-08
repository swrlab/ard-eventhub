# ARD Eventhub Ingest

The Ingest service is used to accept incoming events, distribute them via Pub/Sub and provide methods for users to manage their own subscriptions (self-service).

## Environments

Designated host is Kubernetes but the Docker container will also be used in other environments such as Google Cloud Run for testing purposes.

Several environment variables need to be set in `.env` config in order to run the project:

- REQUIRED `GCP_PROJECT_ID` - which GCP project ID to use for Pub/Sub and Datastore requests
- REQUIRED `FIREBASE_API_KEY` - corresponding `API_KEY` which matches the `GCP_PROJECT_ID`
- REQUIRED `GOOGLE_APPLICATION_CREDENTIALS` - where the Google Cloud Service Account Key can be found (usually a path to a .json file)
- REQUIRED `PUBSUB_SERVICE_ACCOUNT_EMAIL_INTERNAL` - for verification of internal publisher service account
- REQUIRED `STAGE` - can be one of the Stages below to switch several settings
- OPTIONAL `MQTT_BROKER_URL` - CN MQTT gateway (`mqtt://127.0.0.1:1883` with local NATS). Unset skips the inbox dual-write so ingest stays on Pub/Sub. A failed publish never fails the HTTP response.
- OPTIONAL `MQTT_USERNAME` - default `svc-ingest` (publish `inbox.>`, MQTT only)
- OPTIONAL `MQTT_PASSWORD` - default `local` for the local NATS config. Override via sops against a real gateway.
- OPTIONAL `MQTT_TLS_CA` - PEM of the gateway CA, or a path to that PEM. Needed for `mqtts://` against a private CA. Omit for local `mqtt://`.
- OPTIONAL `INGEST_PUBLISH_PLUGINS` - must be the exact string `true` to publish DTS / Radioplayer jobs to the internal Pub/Sub topic. Unset or any other value (`1`, `TRUE`, `false`) leaves dispatch off. Independent of per-event `plugins[].isDeactivated`. Restart the process after changing it. The flag is logged on boot and on every processed event as `ingestPublishPlugins`.
- OPTIONAL `PORT` - override server port setting, default is 8080
- OPTIONAL `DEBUG` - set true to enable more detailed logging

## Stages

Some staging information is auto-detected (whether to run tracing or not), some is configured by the `STAGE` variable.

### DEV

Main difference is the prefix used for Pub/Sub topics, which includes `DEV-`.

### PROD

Uses full production prefixes and configuration.

## Setup

To run this project locally in your development environment you'll need these prerequisites:

1. Node in the respective version currently used by the Dockerfile
2. Rustup toolchain `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs/ | sh`
3. Have a Google Cloud Project and generate a JSON key, place it in the `/keys` folder named `ingest.json`. The service account needs to have these roles (some are only required if you also run it on Cloud Run):

- `roles/datastore.user`
- `roles/errorreporting.writer`
- `roles/iam.serviceAccountTokenCreator`
- `roles/iam.serviceAccountUser`
- `roles/logging.logWriter`
- `roles/monitoring.metricWriter`
- `roles/pubsub.admin`

4. Install dependencies (`bun install`)
5. Run the project (`bun run $command`)

```sh
bun run ingest
```

6. API reference: [swrlab.github.io/ard-eventhub/api](https://swrlab.github.io/ard-eventhub/api) (`/openapi` on the service redirects there)

## Deployment

The deployment process of Eventhub-Ingest is different for `Non-Prod` and `Prod`-Stages.

GitHub Actions builds and pushes the Docker image to the container registry. Deploying to Kubernetes environments is handled separately outside of GitHub Actions.

## Local MQTT publish

Ingest dual-writes each accepted event to `inbox/{institutionId}` on the CN MQTT gateway as `svc-ingest` when `MQTT_BROKER_URL` is set. Unset, the publish stays off and Pub/Sub stays the path of record. A failed publish is logged and does not fail the HTTP response. `just test` still injects the URL from sops. Point it at local NATS (`just nats-up`). Anonymous connects are rejected.

```sh
just nats-up
just nats-sub --all
just dev
```

Against a private mqtts:// gateway, set `MQTT_TLS_CA` to the CA PEM or its file path so mqtt.js can verify the broker.
