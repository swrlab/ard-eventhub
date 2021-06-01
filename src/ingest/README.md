# ARD-Eventhub

## Ingest

The Ingest service is used to accept incoming events, distribute them via Pub/Sub and provide methods for users to manage their own subscriptions (self-service).  

### Environments

Designated host is Kubernetes but the Docker container will also be used in other environments such as Google Cloud Run for testing purposes.

Several environment variables need to be set in `.env` config in order to run the project:

- REQUIRED `GCP_PROJECT_ID` - which GCP project ID to use for Pub/Sub and Datastore requests
- REQUIRED `FIREBASE_API_KEY` - corresponding `API_KEY` which matches the `GCP_PROJECT_ID`
- REQUIRED `GOOGLE_APPLICATION_CREDENTIALS` - where the Google Cloud Service Account Key can be found (usually a path to a .json file)
- REQUIRED `PUBSUB_SERVICE_ACCOUNT_EMAIL_INTERNAL` - for verification of internal publisher service account
- REQUIRED `STAGE` - can be one of the Stages below to switch several settings
- OPTIONAL `PORT` - override server port setting, default is 8080
- OPTIONAL `DEBUG` - set true to enable more detailed logging

### Stages

Some staging information is auto-detected (whether to run tracing or not), some is configured by the `STAGE` variable.

#### DEV

Main difference is the prefix used for Pub/Sub topics, which includes `DEV-`.

#### PROD

Uses full production prefixes and configuration.

## Setup

To run this project locally in your development environment you'll need these prerequisites:

1. Node in the respective version currently used by the Dockerfile and yarn
2. Have a Google Cloud Project and generate a JSON key, place it in the `/keys` folder named `ingest.json`. The service account needs to have these roles (some are only required if you also run it on Cloud Run):
   1. `roles/datastore.user`
   2. `roles/errorreporting.writer`
   3. `roles/iam.serviceAccountTokenCreator`
   4. `roles/iam.serviceAccountUser`
   5. `roles/logging.logWriter`
   6. `roles/monitoring.metricWriter`
   7. `roles/pubsub.admin`
3. Install dependencies (`yarn`)
4. Run the project

   ```sh
   yarn ingest:local
   ```

5. Open http://localhost:8080/openapi/
