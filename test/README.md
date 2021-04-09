# ARD-Eventhub - Unit Tests

## API-Tests

API unit tests are designed to check and verify existing and new implementations with the ARD-Eventhub.  
As test-environment [Mocha](https://mochajs.org/) is used in combination with [Chai](https://www.chaijs.com/) for a readable chaining of test-arguments.

### Environments

In addition to the [ingest-env](../src/ingest/README.md#Environments), following variables are needed in `.env` config for unit tests to work:

- REQUIRED `TEST_USER` - test user email
- REQUIRED `TEST_USER_PW` - test user password
- OPTIONAL `TEST_USER_RESET` - set true for email reset (request limit)

## Setup

Follow the [ingest-setup](../src/ingest/README.md) first, then run tests with

   ```sh
   yarn ingest:test
   ```
