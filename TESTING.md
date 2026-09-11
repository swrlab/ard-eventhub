# ARD Eventhub - Unit Tests

## API-Tests

API unit tests are designed to check and verify existing and new implementations with the ARD Eventhub.
As test-environment [Bun Test runner](https://bun.com/docs/test) is used.

### Environments

In addition to the [ingest-env](../src/ingest/README.md#Environments), following variables are needed for unit tests to work:

- REQUIRED `TEST_USER` - test user email
- REQUIRED `TEST_USER_PW` - test user password
- REQUIRED `MQTT_BROKER_URL` - local NanoMQ hop (`mqtt://127.0.0.1:1883`). Start it with `just mqtt-up` before `just test`. CI starts the same image with `just mqtt-up-docker`.
- OPTIONAL `MQTT_TLS_CA` - hop CA PEM or path. Omit for local `mqtt://`; GKE mqtts:// needs the private CA.
- OPTIONAL `NATS_URL` - Eventhub Connect NATS client (`nats://127.0.0.1:4222`). Not required for ingest tests. Start a local broker with `just nats-up` (Homebrew) or `just nats-up-docker` (Cursor Cloud / CI). Do not run NATS and NanoMQ together — both bind `:1883`.
- OPTIONAL `NATS_USER` / `NATS_PASSWORD` - defaults `svc-sidecar` / `local` (bcrypt hashes in `infra/nats/nats-users.conf`). Production plaintext via sops.
- OPTIONAL `NATS_REQUIRE` - exact string `true` makes NATS access, ACL, and bridge live tests fail instead of skip when `:4222` is down. The separate CI NATS job sets this. That job also runs `just nats-check` and `just nats-check-invalid`. Live bridge tests need NATS MQTT (`svc-bridge` / `local`).
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
