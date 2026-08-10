# ARD Eventhub - Unit Tests

## API-Tests

API unit tests are designed to check and verify existing and new implementations with the ARD Eventhub.
As test-environment [Bun Test runner](https://bun.com/docs/test) is used.

### Environments

In addition to the [ingest-env](../src/ingest/README.md#Environments), following variables are needed in `.env` config for unit tests to work:

- REQUIRED `TEST_USER` - test user email
- REQUIRED `TEST_USER_PW` - test user password
- OPTIONAL `TEST_USER_RESET` - set true for email reset (request limit)

## Setup

Follow the [ingest-setup](../src/ingest/README.md) first. Tests import `src/config/users.json`. For the CI allow-list fixture:

```sh
# requires the CI age private key in SOPS_AGE_KEY
sops decrypt src/config/users.ci.sops.json > src/config/users.json
```

Then run tests with:

```sh
just test
```
