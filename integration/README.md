# Eventhub ingest / integration

This folder contains a [hurl](https://hurl.dev/) script that exercises the same ingest API surface as [`src/ingest/server.test.ts`](../src/ingest/server.test.ts). Run it against a local ingest process or a deployed host.

## What's Hurl?

Hurl is a command-line tool that runs HTTP requests defined in a simple plain text format.

It can chain requests, capture values, and evaluate queries on headers and body responses. Use it both to fetch data and to test HTTP sessions.

## Installation

On macOS with Homebrew:

```shell
brew install hurl
```

For other systems, see the [installation docs](https://hurl.dev/docs/installation.html).

## How to run

Start ingest locally (`just dev`) or point at a remote host, then:

```shell
# local (default host http://localhost:8080)
just integration

# remote test stage
just integration "https://eventhub-ingest-test.ard.de"
```

`just integration` loads `TEST_USER` / `TEST_USER_PW` from the sops env (same as `just test`) and generates current / expired start timestamps for event bodies.

Or invoke hurl directly:

```shell
hurl --variable host="http://localhost:8080" \
	--variable email="$TEST_USER" \
	--variable password="$TEST_USER_PW" \
	--variable start="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
	--variable start_expired="$(bun -e 'console.log(new Date(Date.now() - 20 * 60 * 1000).toISOString())')" \
	--variable start_invalid="$(date -u +%Y-%m-%dT%H:%M:%SZ)00" \
	--test integration/ingest-api.hurl
```

Everything lives in one file (`ingest-api.hurl`) so login captures (`access_token`, `refresh_token`, `topic_id`, `subscription_name`) carry through the chain. Hurl isolates variables per input file, so a multi-file split cannot share tokens the way `server.test.ts` does.

### Test option

Without `--test`, hurl prints the last response body. With `--test`, it only reports assert results:

```shell
hurl --test integration/ingest-api.hurl
```

## Coverage (mirrors `server.test.ts`)

1. **Auth** — `POST /auth/login`, `POST /auth/refresh`
2. **Events** — missing (401) / invalid (403) auth, publish, validation errors, media `isFallback`, blocked services / common plugin
3. **Pub/Sub** — `PUT /pubsub` missing (401) / invalid (403); `POST /pubsub` missing (401) / invalid (500, Google OIDC)
4. **Topics** — `GET /topics` and `GET /topics/{name}` missing (401) / invalid (403), then list
5. **Subscriptions** — create, list, get, delete each with missing (401) / invalid (403) auth

`POST /auth/reset` is omitted on purpose (Firebase rate limit of ~150/day). Use the unit test with `TEST_USER_RESET=true` when you need it.

## Documentation

See the [hurl docs](https://hurl.dev/docs).
