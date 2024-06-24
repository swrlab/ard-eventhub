# ARD-Eventhub / Secrets

This repository obviously needs a number of secrets and configuration files that are kept in various places. This page documents what goes where.
Since this project is designed to be kept public to allow a collaborative development process, the full configuration around secrets and their deployment process is not described to the fullest extend here. There are other places, which include more about the internal maintenance structure.

## Code

Different modules might need varying sets of variables. Check the README of each provided module to see more about those.
Usually it only requires few API keys to external services. Access to Google Cloud services is given by a [service account](https://cloud.google.com/iam/docs/service-accounts) (SA), with only the minimum set of permissions needed. This SA is added using an environment variable.

## Github

Secrets in Github are write-only by default for users. Admins can change them in Settings -> Secrets but they cannot be read. Only Github Actions has access and can use them in workflows. They are hidden from logs in Actions by default.

- `GCP_GITHUB_SERVICE_ACCOUNT_KEY`
  - Encoded in base64
  - Service Account used to log into Google Cloud services, used for pushing containers to registry and accessing services for pull checks
  - Stored in Github to log into registry
- `GCP_PROJECT_ID`
  - The project ID of the Google Cloud account used for primary services such as Pub/Sub
  - Stored in Github to run test workflows on pull checks
- `GCP_SERVICE_ACCOUNT_INGEST`
  - E-mail address of the service account used for Cloud Run
  - Stored in Github to configure new revisions
- `TEST_FIREBASE_API_KEY`
  - API key for Firebase, used to run pull checks
- `TEST_USER`
  - E-mail address of the test user for `STAGE=dev` which is used to run test checks
- `TEST_USER_PW`
  - Corresponding password for the test user

## Google Cloud

When this project is deployed to Google Cloud for example, it also needs environment variables and keys. Those are usually provided by the runtime and its deployment configuration. The location of all Kubernetes deployments files is explicitly not mentioned here, but if have access to said environment, you should know where to start searching.

### Docker Image

Kubernetes needs to pull the image from some specified registry. Usually there's one central place for these images. For eventhub we are not using this place to avoid adding their key to this repository. Instead we are storing containers in our eventhub project and are giving access to their SA.
To do this, open the console, navigate to the eventhub project, go to storage, select the artifact bucket. In the info panel, add their SA email address with the permission "_Storage Object Viewer_".
