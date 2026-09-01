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
- REQUIRED `MQTT_BROKER_URL` - MQTT hop connection string (`mqtt://127.0.0.1:1883` locally). Put credentials in the URL when the broker needs them (`mqtts://user:pass@host:8883`). A failed publish never fails the HTTP response.
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

## Local MQTT hop

Ingest dual-writes each accepted event to `inbox/{institutionId}` on NanoMQ. `MQTT_BROKER_URL` is required, including for `just test` (local hop). Pub/Sub stays the path of record. Locally use Apple's `container` CLI (`just mqtt-up`), not `docker`. CI starts the same image with `just mqtt-up-docker`.

```sh
container system start   # once, if `container` says the apiserver is not running
just mqtt-up
just mqtt-sub            # one institution (default SWR example URN)
just mqtt-sub --all      # every inbox on the hop
just dev
# POST a track event, then just mqtt-restart to confirm nothing is retained
just mqtt-down
```

GCP apply for the hop is out of band. Manifests live in [`infra/nanomq/`](../../infra/nanomq/).
