# AGENTS.md

Instructions for AI coding agents working on ARD Eventhub.

## Project

ARD Eventhub distributes real-time metadata for radio broadcasts. Ingest (`src/ingest/`) receives events and manages subscriptions. Connect (`src/connect/`) is the NATS access layer, with inbox validation, the operator UI, and MCP. Shared code is in `src/utils/`. Request and response contracts are Zod schemas in `src/schemas/`, assembled into OpenAPI and AsyncAPI.

Read the doc next to the code you change:

- [README.md](README.md) — what the system is and how to set up a local checkout
- [src/ingest/README.md](src/ingest/README.md) — ingest service
- [src/connect/README.md](src/connect/README.md) — connect, NATS, operator UI, MCP
- [infra/kubernetes/README.md](infra/kubernetes/README.md) and [infra/nixos/README.md](infra/nixos/README.md) — hosts
- [docs/development/](docs/development/) — secrets, stages, naming, certificates
- [TESTING.md](TESTING.md) — how to run tests
- [integration/README.md](integration/README.md) — Hurl suite

Tasks are `just` recipes. `just --list` is the index.

## Language

Code, filenames, variables, comments, and JSDoc are English. Operator UI copy and `docs/` are German. Internal docs in `docs/development/` and RFCs in `docs/context-rfc/` are English (US).

Never use Python. Not for scripts, recipes, generators, glue, or one-off helpers. Use TypeScript, or shell in a `just` recipe.

## Changes

- Match the surrounding code. Oxfmt owns formatting; `just lint` checks and `just format` fixes.
- A behavior change includes or updates a co-located `*.test.ts`. Tests use `@cross/test`, `@std/assert`, and sinon so the same file runs on Bun, Node, and Deno. Fix a failing test and keep it in the suite. `just test` and `just lint` pass before a PR.
- A `package.json` change that feeds the OpenAPI or AsyncAPI `info` block, including `version`, needs `just openapi` so `openapi.json` and `asyncapi.json` stay in sync. Schema and path edits are covered in [docs/openapi.md](docs/openapi.md) and [docs/asyncapi.md](docs/asyncapi.md).
- Update `docs/` when user-facing behavior changes.

## Git

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) and are signed (SSH or GPG). Development branches are `dev/*` or `feature/*`. Only `main` deploys to production.

## Boundaries

Ask before changing Google Cloud configuration, authentication, dependencies, or the architecture.

Leave secrets encrypted. Shared secrets use sops; runtime secrets use Secret Manager. See [docs/development/secrets.md](docs/development/secrets.md). Add dependencies with `bun install` and leave `node_modules/` and `bun.lock` to that command. The project license is MIT.
