# ARD Eventhub - Unit Tests

## API-Tests

API unit tests are designed to check and verify existing and new implementations with the ARD Eventhub.
As test-environment [Bun Test runner](https://bun.com/docs/test) is used.

### Environments

In addition to the [ingest-env](../src/ingest/README.md#Environments), following variables are needed for unit tests to work:

- REQUIRED `TEST_USER` - test user email
- REQUIRED `TEST_USER_PW` - test user password
- OPTIONAL `MQTT_BROKER_URL` - CN MQTT gateway (`mqtt://127.0.0.1:1883` with local NATS). Ingest boots without it. The sops test env sets it so the inbox client can connect. For a live round-trip, start the broker with `just nats-up` (or `just nats-up-docker`). CI ingest jobs start that broker with `just nats-up-docker`. `svc-ingest` ACLs run in the separate NATS job.
- OPTIONAL `MQTT_USERNAME` / `MQTT_PASSWORD` - defaults `svc-ingest` / `local`. Production plaintext via sops.
- OPTIONAL `MQTT_TLS_CA` - gateway CA PEM or path. Omit for local `mqtt://`.
- OPTIONAL `NATS_URL` - Eventhub Connect NATS client (`nats://127.0.0.1:4222`). Not required for ingest tests. Start a local broker with `just nats-up` (Homebrew) or `just nats-up-docker` (Cursor Cloud / CI). MQTT on that process binds `:1883`.
- OPTIONAL `NATS_USER` / `NATS_PASSWORD` - defaults `svc-sidecar` / `local` (bcrypt hashes in `infra/kubernetes/components/users/nats-users.conf`).
- OPTIONAL `NATS_REQUIRE` - exact string `true` makes NATS access and ACL tests fail instead of skip when `:4222` is down. The separate CI NATS job sets this. That job also runs `just nats-check`. Live ACL tests include `svc-ingest` publishing `inbox.>`.
- OPTIONAL `TEST_USER_RESET` - set true for email reset (request limit)

Locally these usually come from `.env.sops.yaml` via `just test`. CI injects them from `.env.ci.sops.yaml` with `sops exec-env`.

## Setup

Follow the [ingest-setup](../src/ingest/README.md) first. Tests import `src/config/users.json`. For the CI allow-list fixture:

```sh
# requires the CI age private key in SOPS_AGE_KEY
sops decrypt src/config/users.ci.sops.json > src/config/users.json
```

Then run tests with:

```sh
just test
# or CI-equivalent:
SOPS_ENV_FILE=.env.ci.sops.yaml just env "bun test --timeout 120000"
```

## Hurl integration tests

[`integration/`](integration/) mirrors the HTTP flows in `src/ingest/server.test.ts` as [hurl](https://hurl.dev/) scripts (same idea as ard-vox). Requires a running ingest (`just dev`) or a remote host, plus `hurl` on `PATH` (`brew install hurl`).

```sh
just integration
just integration "https://eventhub-ingest-test.ard.de"
```

See [`integration/README.md`](integration/README.md) for coverage and variables.
