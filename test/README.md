# ARD Eventhub - Unit Tests

## API-Tests

API unit tests are designed to check and verify existing and new implementations with the ARD Eventhub.  
As test-environment [Mocha](https://mochajs.org/) is used in combination with [Chai](https://www.chaijs.com/) for a readable chaining of test-arguments.

### Environments

It needs several environment variables to work:

- REQUIRED `STAGE` - can be one of the Stages DEV / PROD
- REQUIRED `GCP_PROJECT_ID` - which GCP project ID to use for Pub/Sub and Datastore requests
- REQUIRED `FIREBASE_API_KEY` - corresponding `API_KET` which matches the `GCP_PROJECT_ID`
- OPTIONAL `PORT` - override server port setting, default is 8080
- REQUIRED `TEST_USER` - test user email
- REQUIRED `TEST_USER_PW` - test user password

## Setup

To run the tests follow the [ingest-setup](../src/ingest/README.md) first

Run the project (replace `gcp-project`, `fb-api-key`, `test-user-email` and `test-user-password`)

   ```sh
   STAGE=DEV \
   GCP_PROJECT_ID=gcp-project \
   FIREBASE_API_KEY=fb-api-key \
   TEST_USER=test-user-email \
   TEST_USER_PW=test-user-password
   yarn ingest:test
   ```
