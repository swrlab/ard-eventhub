---
title: 'RFC 0001 — Eventhub: Current State'
description: 'Retrospective RFC: what ARD Eventhub is today, how it got here, and where the rough edges are.'
sidebar:
  order: 1
---

- **Status:** Descriptive (retrospective) — records reality, does not propose change
- **Describes version:** `3.0.0-beta.1`
- **Last reviewed:** 2026-08-28
- **Scope:** the `ard-eventhub` repository and the deployed ingest service

> This page is written in English, unlike the rest of these docs. It is an engineering-context
> artifact aimed at maintainers and coding agents, not at publishers integrating with the API.
> For integration guides, start at _Benutzer-Guides_.

## 1. Why this document exists

Most of the documentation here answers "how do I use Eventhub?". Nothing answers "why does Eventhub
look like this?". That knowledge lives in five years of commits, a changelog written as one-line
bullets, and the heads of three people.

This is a retrospective RFC: it describes the system as built, reconstructs the decisions that
shaped it, and names the places where the implementation and the documentation have drifted apart.
It is meant to be the single document you read before touching the codebase — or the one you hand
to an LLM as context.

It is deliberately not a proposal. Where something looks wrong, it is recorded in
[§10 Known gaps](#10-known-gaps-and-rough-edges) rather than fixed in prose.

## 2. Summary

ARD Eventhub is a single Hono service on Bun that accepts now-playing metadata from ARD
broadcasters over HTTP and fans it out over Google Cloud Pub/Sub. A publisher POSTs a track event;
the service authenticates them against Firebase plus a local allow-list, checks that they are
actually allowed to publish for the livestream they claim, and then writes the same enriched
message to up to three places: the livestream's own topic, a shared firehose topic, and an internal
topic that drives outbound plugins (DTS/Xperi, Radioplayer). Subscribers self-serve HTTPS push
subscriptions through the same API.

Ten ARD institutions publish to production today. The architecture has been stable since 2021; what
changed over five years is almost entirely the implementation underneath it — Node to Bun,
JavaScript to TypeScript, Express to Hono, JSON Schema to Zod, Datastore-backed users to an
encrypted file.

## 3. What the system does

Radio stations know what is on air right now. That fact is useful far beyond the station's own
player: connected-car dashboards, aggregator apps, ARD Sounds, third-party platforms like
Radioplayer. Before Eventhub, every consumer negotiated a bilateral feed with every broadcaster.

Eventhub inverts that. Broadcasters publish once, in one format, to one endpoint. Consumers
subscribe to exactly the livestreams they care about. The service owns three things in the middle:
identity (who is allowed to speak for which station), a canonical event schema, and the fan-out.

Three actor groups:

- **Publishers** — playout and scheduling systems inside ARD institutions. They authenticate with
  a Firebase account and POST track events. One institution may cover many livestreams.
- **Subscribers** — internal and partner systems that create Pub/Sub push subscriptions and receive
  events over HTTPS.
- **Plugin targets** — external platforms Eventhub pushes to on the publisher's behalf, currently
  DTS/Xperi and Radioplayer. Publishers opt out rather than in.

## 4. Architecture today

### 4.1 Scope

Eventhub is the publish side only. It accepts events and distributes them; it holds no event history
and offers consumers no way to query what is playing. Subscribers receive events over Pub/Sub push
and keep their own state. The consumer-facing read APIs (Now & Next) belong to the ARD Play-out
Center, which built them into its existing system and is fed by the common topic
([§6](#6-distribution-model)).

Everything in `src/ingest/` is the running service; `src/utils/` is shared code with a single
consumer.

### 4.2 Stack

Bun is both the package manager and the runtime — `bun ./src/ingest/server.ts` in production, no
build step, no transpile. TypeScript runs directly, `tsconfig.json` is `noEmit` and exists for type
checking only. Hono handles HTTP, Zod owns validation and doubles as the OpenAPI source, and the
Google Cloud SDKs cover Pub/Sub, Datastore, and Firebase Admin.

Tooling is Oxc (`oxlint` + `oxfmt`), `just` for tasks, `mise` to pin `just` and `sops`, `hurl` for
the black-box API suite, and Blume for the docs site.

### 4.3 Startup

`src/ingest/server.ts` awaits `getARDFeed()` before it serves a single request. The ARD Core
livestream feed is the authority on which publishers exist and which institution owns them, so the
service refuses to run without it. The feed is validated on arrival — item count between 190 and
251, single page, and a hardcoded list of stations (`WDR 2`, `SWR3`, `hr3`, …) must all be present.
Any failure calls `process.exit(1)`.

That is a deliberate fail-fast: a truncated feed would silently start blocking legitimate
publishers, which is worse than not starting.

### 4.4 Stages

`STAGE` is a single environment variable with three legal values, and it fans out into the
Datastore namespace, every Pub/Sub name, and plugin endpoint selection. Deployment environments are
a separate concept — `beta` is a deployment that runs with `STAGE=prod`.

| Concern        | `dev`                  | `test`                  | `prod`                  |
| -------------- | ---------------------- | ----------------------- | ----------------------- |
| Datastore      | namespace `dev`        | namespace `test`        | namespace `prod`        |
| Pub/Sub prefix | `de.ard.eventhub.dev.` | `de.ard.eventhub.test.` | `de.ard.eventhub.prod.` |
| DTS endpoint   | dev endpoint           | test endpoint           | prod endpoint           |
| Radioplayer    | off unless overridden  | off unless overridden   | on                      |

Deployments: `dev` on Cloud Run for internal work, `test` / `beta` / `prod` on Kubernetes behind
`eventhub-ingest-test.ard.de`, `eventhub-ingest-beta.ard.de`, and `eventhub-ingest.ard.de`.
GitHub Actions builds and pushes images to Artifact Registry in `europe-west3`; the actual
Kubernetes rollout happens outside GitHub Actions.

## 5. The event path

This is the hot path and the part worth understanding in full. Everything else in the service
exists to support it.

`POST /events/:eventName`, where `eventName` is `de.ard.eventhub.v1.radio.track.playing` or
`de.ard.eventhub.v1.radio.track.next`.

**Middleware.** A 400 KB JSON body limit (`src/utils/validation/json-body-limit.ts`) rejects
oversized payloads with 413 before anything is parsed. Then `authVerify`, then `validateEventBody`.

**Authentication** (`src/ingest/auth/verify.ts`). The JWT is pulled from `x-authorization` or
`authorization`, with the `Bearer` prefix optional. Firebase Admin verifies it. Then — and this is
the part that surprises people — the token's email is looked up in `src/config/users.json`, a
mounted allow-list. A valid Firebase token for an account that is not in that file gets 403. The
resulting `AuthUser` carries the institution URN, which drives every authorization decision
downstream.

**Validation** (`src/schemas/events.ts`, `eventV1PostBody`). A strict Zod schema: unknown top-level
keys are rejected. Required are `type`, `start`, `length`, `title`, `services[]`, and
`playlistItemId`. Zod issues are translated into the legacy OpenAPI-validator error shape by
`zodToOpenApiError`, then passed through `sanitizeValidationError`, which only lets allow-listed
messages reach the client and collapses everything else into a generic `Bad request`.

**Freshness.** `start` must not be more than 15 minutes in the past
(`MAX_OFFSET_IN_MINUTES` in `src/utils/events/event-helpers.ts`). Late events are a stronger signal
of a broken playout integration than of a genuinely late track, and republishing stale now-playing
data to car dashboards is worse than dropping it.

**Service resolution** (`src/utils/events/process-services.ts`). For each entry in `services[]`:

1. The topic URN is `services[].id` when that is already a livestream URN. Otherwise it is derived: `coreIdPrefixes[type] + createHashedId(externalId)`. The same value is written to `services[].id`.
2. `publisherId` is normalized to `urn:ard:publisher:{hash}` if a legacy numeric ID was sent.
3. The publisher is looked up in the cached ARD feed. `institutionId` is filled from that publisher, or from the authenticated user's institution when the publisher is unknown.
4. Nightly nationwide broadcasts are checked against `src/config/allowed-livestreams.json`.
5. Unknown publishers are blocked.
6. The publisher's institution must equal the authenticated user's institution.

Failures here set `service.blocked` to a reason string. Blocked services stay in the array — the
publisher gets a per-service verdict rather than a single opaque rejection, which matters when one
POST covers a dozen livestreams.

**Publishing** (`src/utils/events/process-event.ts`). The enriched message gets
`id = {institutionId}-{ulid()}` and is published to each non-blocked service's topic. If the topic
does not exist yet, `createNewTopic` writes a Datastore record and creates the Pub/Sub topic — but
does not retry the publish. See [§10.1](#101-the-first-event-to-a-new-topic-is-dropped).

**Response.** HTTP 201 with `{ statuses, plugins, event, trace }`. `statuses` counts
`published` / `blocked` / `failed`; `plugins` lists the common-topic and plugin-job publishes;
`event` is the fully enriched message including per-service topic metadata; `trace` is always
`null` and deprecated.

## 6. Distribution model

One accepted event produces up to three distinct Pub/Sub writes. They are independent: a failure in
the second or third does not fail the request.

**Per-livestream topics.** `de.ard.eventhub.{stage}.{url-encoded core ID URN}`. This is what
subscribers should use. Attributes on every message: `event`, `stage`, `version`.

**The common/firehose topic.** `de.ard.eventhub.{stage}.v1.radio.track.playing` (and `.next`),
carrying every non-blocked event across all broadcasters. This is how ARD Sounds ingests data. It
is documented with a warning to prefer per-livestream topics, because the volume is high and mostly
irrelevant to any single consumer.

**The internal plugin topic.** `de.ard.eventhub.{stage}.internal` receives a job envelope
(`{ action, event, plugin, institutionId }`) for each active plugin. Pub/Sub delivers it back to
the same service at `POST /pubsub`, authenticated with a Google OIDC token whose email must match
`PUBSUB_SERVICE_ACCOUNT_EMAIL_INTERNAL`.

That last one is worth dwelling on: outbound plugin calls are deliberately not made inline. A slow
DTS API would otherwise add latency to every publisher's request. Routing through Pub/Sub means the
publisher gets its 201 immediately and the external POST happens on a separate, retryable delivery.
The cost is that plugin failures are invisible in the API response.

## 7. Identity and authorization

Authorization is a two-key model, and both keys are checked on every event:

1. **Who are you?** Firebase Auth verifies the JWT; `users.json` confirms the account is provisioned
   and maps it to an institution URN.
2. **May you speak for this livestream?** The ARD Core feed resolves the claimed `publisherId` to
   its owning institution, which must match yours.

The second check is why the feed is a startup dependency. Without it there is no way to tell whether
SWR is allowed to publish for a WDR stream.

Three other auth surfaces exist. `POST /auth/login`, `/auth/refresh`, and `/auth/reset` are
unauthenticated and proxy Firebase Identity Toolkit. `POST /pubsub` uses Google OIDC as described
above. `PUT /pubsub` accepts a normal publisher JWT and exists for manual replay during debugging.

## 8. Identifiers

Publishers send their own identifiers; Eventhub derives ARD Core IDs from them. Nothing is looked up
in a registry at request time except the publisher.

- **Topic core IDs** — `urn:ard:permanent-livestream:{hash}` or `urn:ard:event-livestream:{hash}`,
  where the hash is CRC64-ECMA182 over the publisher's `externalId` (a `crid://` URI). Prefixes live
  in `src/config/core-id-prefixes.json`. Reproduce one with `just coreId "crid://..."`.
- **Publisher URNs** — `urn:ard:publisher:{hash}`. Legacy numeric IDs (`282310`) are still accepted
  and hashed on the fly.
- **Pub/Sub names** — `de.ard.eventhub.{stage}.` plus the URL-encoded URN.
- **Event IDs** — `{institutionId}-{ulid()}`, assigned by Eventhub. ULID replaced UUIDv4 in v1.8.0
  because lexicographic sortability is useful in logs and Datastore keys.
- **Subscription names** — `de.ard.eventhub.{stage}.subscription.{ulid}`.

Because topic IDs are derived from `externalId`, a publisher changing its CRIDs silently creates new
topics and orphans every existing subscription. This is why the DTS docs warn against changing IDs.

## 9. Plugins

Both real plugins are **opt-out**, and only for music now-playing events. `ensureDefaultPlugins`
adds `dts` and `radioplayer` entries when `type === 'music'` and the event is
`de.ard.eventhub.v1.radio.track.playing`. Publishers disable them per event with
`plugins: [{ type: 'dts', isDeactivated: true }]`.

**DTS/Xperi** maps events to the DTS LiveRadio API. Credentials and per-stage endpoints come from
the base64-encoded `DTS_KEYS` env var, keyed by institution. Per-event options cover `delay`,
`album`, `composer`, `program`, `webUrl`, `preferArtistMedia`, and `excludeFields`. It became
opt-out in v1.6.0 and was enabled for all institutions in v1.7.2.

**Radioplayer** POSTs to `np-ingest.radioplayer.cloud`. It needs an API key for the institution
(`RADIOPLAYER_API_KEYS`), a `PermanentLivestream` service, and an entry in
`src/config/radioplayer-mapping.json5` mapping the livestream URN to one or more Radioplayer station
UIDs. A mapping value of `false` disables a stream. It only fires in `prod` unless
`RADIOPLAYER_RUN_IN_NON_PROD=true` — a guard added in v2.3.1 after test traffic reached the live
Radioplayer endpoint.

**ARD Sounds** is documented as a plugin but is not code. It consumes the common firehose topic.

## 10. Known gaps and rough edges

These are current, verified against the code at `3.0.0-beta.1`. None are secret; several are
long-standing trade-offs rather than bugs.

### 10.1 The first event to a new topic is dropped

`createNewTopic` (`src/utils/events/create-new-topic.ts:81`) creates the topic and then sets
`service.topic.messageId = null` without retrying the publish. `summarizeEventStatuses` counts a
service with no `messageId` and no `blocked` reason as **failed**. So the first event for any new
livestream returns `failed: 1` and is genuinely lost. Self-heals on the next event, which is why it
has survived this long, but it does mean a publisher onboarding a new stream sees a failure they
cannot explain.

### 10.2 The ARD feed is never refreshed

`getARDFeed()` is called once at startup and cached in a module-level variable
(`src/utils/ard-feed.ts:66`). There is no timer and no invalidation. A new livestream or a changed
publisher/institution mapping in ARD Core only takes effect after a pod restart.

### 10.3 Plugin delivery is invisible to publishers

Plugin jobs are fire-and-forget over Pub/Sub, and `POST /pubsub` returns 204 on error to stop
Pub/Sub from retrying aggressively (`src/ingest/pubsub/index.ts`). A publisher whose DTS credentials
expired gets a clean 201 forever. The only signal is in the logs.

### 10.4 The DTS commercial mapping is dead code

`src/utils/plugins/dts/event.ts:52` maps `event.type === 'advertisement'` to DTS type `ad`, but the
event schema's enum has no `advertisement` — the value is `commercial`. Commercials are therefore
mapped to `other`. The rename happened on the schema side and the plugin was not updated.

### 10.5 Documentation drift

- `docs/development/naming.md` documents subscriptions as
  `de.ard.eventhub.subscription.{stage}.{uuid}`. The code produces
  `de.ard.eventhub.{stage}.subscription.{ulid}` — different segment order, and ULID not UUID since
  v1.8.0.
- `src/ingest/README.md` describes a Node + rustup setup and a `DEBUG` env var that no code reads.
- `README.md` lists `@google-cloud/secret-manager` and `luxon` in the third-party table. Neither is
  a dependency any more; secrets moved to sops and dates to `@frytg/dates`.
- `README.md` lists `node:22-alpine` as the Docker base. It is `oven/bun:1-alpine`.

### 10.6 Smaller items

- `GET /topics/:topicName` ignores the path parameter and returns the full topic list.
- `serviceUrl` in `src/config.ts` resolves to `eventhub-ingest.ard.de` for both `test` and `prod`;
  only `dev` differs.
- The push-subscription OIDC service account is hardcoded to
  `publisher@ard-eventhub.iam.gserviceaccount.com` in `src/utils/pubsub/create-subscription.ts`,
  while inbound verification reads `PUBSUB_SERVICE_ACCOUNT_EMAIL_INTERNAL` from the environment.
- No CORS, no rate limiting, and no request-correlation ID. `trace` in responses is a vestige of a
  correlation mechanism that no longer exists and is now always `null`.
- The Dockerfile copies the whole repo with no multi-stage prune, so build context and image include
  everything not in `.dockerignore`.

## 11. Supporting systems

**State.** Datastore holds exactly two kinds, both namespaced by stage: `topics` (creator,
core ID, external ID, institution, publisher) and `subscriptions` (contact, institution, URL). Note
what is _not_ there — since v1.9.2 event payloads are not persisted at all, and since v3 users moved
out to a file. Datastore is metadata only.

**Configuration.** Twelve environment variables, ten required at import time via
`@frytg/check-required-env` (`src/env.ts`) — a missing one crashes at startup rather than at first
use. Four JSON config files ship in `src/config/`: core ID prefixes, the nightly-broadcast
allow-list, the Radioplayer mapping, and the gitignored `users.json`.

**Secrets.** Everything is sops-encrypted and committed, so secret changes are reviewed in the same
PR as the code that uses them. Local development runs through `sops exec-env` (`just env`), CI
decrypts `.env.ci.sops.yaml` with an age key from a GitHub secret, and Kubernetes secrets come from
`keys/k8s-secrets.sops.yaml` via `just apply-k8s-secrets`. Plaintext is never written to disk.

**API contract.** `openapi.json` is generated from the Zod schemas by `just openapi`
(`z.toJSONSchema` with `target: 'openapi-3.0'`). The schemas are the source of truth; the JSON is a
build artifact that happens to be committed. It must be regenerated after any schema change and
after any `package.json` version bump, since `info.version` is read from there. The service no
longer serves Swagger UI — `/openapi` redirects to the docs site.

**Testing.** Unit tests use `@cross/test` + `@std/assert` + sinon so the same files run on Bun,
Node, and Deno; CI runs Bun only. `src/ingest/server.test.ts` exercises the full HTTP surface
against a live Hono app with real Firebase credentials. `integration/ingest-api.hurl` mirrors it as
a black-box suite against a running service. Both need `TEST_USER` / `TEST_USER_PW` from sops.

**CI.** `ingest-push.yml` runs security scan, lint, tests, then builds and pushes a Docker image
tagged `{version}-g{run_number}` on `feature/*` and `dev/*`. `ingest-pull.yml` runs the same checks
plus license compliance, gated on a `safe to test` label because it uses `pull_request_target` and
needs secrets. `docs-push.yml` builds Blume and deploys to GitHub Pages on `main`.

## 12. How we got here

**2021 — prototype to v1.** First commit January 2021, first deployed prototype in March. The
`0.1.x` series established the shape that still holds: `/events` with per-service results, JSON
logging, dev/prod topic separation. `1.0.0-beta1` was the first hard break — `serviceIds` gave way
to `services[]` with `type`/`externalId`/`publisherId`, and the event name moved from the body to
the URL. The DTS plugin landed in `1.1.0`, establishing the pattern of Eventhub pushing on a
publisher's behalf.

**2021–2023 — consolidation.** Mostly dependency churn and new channels, plus two structural
additions. `1.6.0` introduced the common Pub/Sub topic (the firehose that ARD Sounds now consumes)
and prepared DTS as opt-out; `1.7.2` turned it on for everyone. `1.5.0` moved DTS keys out of GCP
Secret Manager into environment variables — the first step away from cloud-managed secrets.

**2024 — infrastructure modernization.** `1.8.0` swapped yarn for Bun as package manager,
UUIDv4 for ULID, and eslint for Biome. `1.9.2` stopped storing event payloads in Datastore, which
cut cost and removed a category of data-retention questions.

**2025 — ARD Core as source of truth.** `1.10.2` replaced the local livestream/publisher file with
the live ARD Core feed API. This is the single most consequential change in the service's history:
authorization stopped being a thing the Eventhub team maintained by hand and became a projection of
central ARD data. `2.0.0` then moved the whole codebase from JavaScript on Node to TypeScript on
Bun.

**2026 — the v3 refactor.** The current cycle, largely landed in `3.0.0-beta.1` (tagged
2026-08-11, on `test` from the same date):

- Express to Hono, and `express-openapi-validator` to Zod. Validation became code rather than a
  JSON Schema document, and OpenAPI became a generated artifact instead of a hand-maintained one.
- Users moved from Datastore to a sops-encrypted `users.json` mounted into the pod. One less
  runtime dependency on the request path, and user changes became reviewable in git.
- `bun:test` replaced with `@cross/test` so tests are not locked to one runtime.
- Biome replaced with Oxc; `mise` added to pin `just` and `sops`; `hurl` added for black-box API
  tests; docsify replaced with Blume for a statically built docs site (`2.4.0`).
- Breaking changes for publishers: the radiotext event type removed, `x-ard-eventhub-uid` response
  header dropped, `length` now required and positive, `trace` deprecated, 401 responses now carry
  the documented JSON body, and stricter publisher validation.

Read as a whole, the trajectory is consistent: fewer moving parts at runtime, more validation
pushed into types, and more state moved out of databases into reviewed files or upstream systems of
record.

## 13. Open questions

Not blockers, but the things a maintainer should have an opinion about:

- Should the first-event-drops behaviour ([§10.1](#101-the-first-event-to-a-new-topic-is-dropped))
  be fixed by retrying the publish after topic creation, or by pre-creating topics from the ARD feed
  at startup?
- Should the ARD feed refresh on an interval? A periodic refresh removes the restart requirement but
  introduces the risk of a bad feed taking down a healthy pod mid-flight — the current fail-fast at
  startup is at least predictable.
- Should plugin delivery failures surface anywhere a publisher can see them, or is the log the right
  place given the fire-and-forget design?
- `trace` is deprecated and always `null`. When does it actually get removed, and does that need its
  own major?
- The `beta` deployment runs `STAGE=prod` against production topics. Is that still wanted, or should
  it get its own stage?

## 14. References

- Code: [`swrlab/ard-eventhub`](https://github.com/swrlab/ard-eventhub)
- [Changelog](https://github.com/swrlab/ard-eventhub/blob/main/CHANGELOG.md) — full version history
- [Eventhub v3 — Plan](https://github.com/swrlab/ard-eventhub/discussions/771) — roadmap discussion
- [`AGENTS.md`](https://github.com/swrlab/ard-eventhub/blob/main/AGENTS.md) — contributor and agent conventions
- Internal: [Confluence](https://confluence.ard.de/x/il8uGw)
- In these docs: _Migration auf Eventhub v3_, _Stages_, _Namenskonventionen_, _Allgemeine IDs_
