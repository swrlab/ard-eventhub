# AGENTS.md

Instructions for AI coding agents working on ARD Eventhub.

## Project Overview

ARD Eventhub is a system to distribute real-time (live) metadata for primarily radio broadcasts. It uses Bun as the runtime and package manager, TypeScript for type safety, and Google Cloud services (Pub/Sub, Datastore, Secret Manager) for backend infrastructure.

## Setup Commands

- **Install tools:** [mise](https://mise.jdx.dev) → `mise install` (pins `just` + `sops` in [`mise.toml`](mise.toml))
- **Install dependencies:** `bun install`
- **Start ingest service:** `bun run ingest` (runs with hot reload)
- **Run tests:** `just test`
- **Hurl API suite:** `just integration` (needs running ingest + `hurl`)
- **Lint code:** `just lint` (uses Oxlint)
- **Format code:** Oxfmt handles formatting automatically
- **Docs (dev):** `just docs` (Blume)
- **Docs (build):** `just docs-build` (writes to `dist/`)

Docs deploy via [`.github/workflows/docs-push.yml`](.github/workflows/docs-push.yml) to GitHub Pages. The repo Pages source must be set to **GitHub Actions** (not “Deploy from a branch”). `cookie@2` is pinned as a devDependency so Astro’s prerender can resolve ESM exports while Express keeps nested `cookie@0.7`.

Regenerate OpenAPI and AsyncAPI for docs with `just openapi` (Zod schemas → `openapi.json` via `z.toJSONSchema`; also writes `asyncapi.json`). **Always run `just openapi` after changing `package.json` version** (or any other field that feeds the OpenAPI / AsyncAPI `info` block) so both specs stay in sync. AsyncAPI only: `just asyncapi`.

## Project Knowledge

- **Tech Stack:** Bun, Node.js, TypeScript (strict mode), Hono, Zod, Google Cloud Platform
- **File Structure:**
  - `src/ingest/` – Ingest service (receives events, manages subscriptions)
  - `src/schemas/` – Zod request/response schemas (runtime validation + OpenAPI)
  - `src/openapi/` – OpenAPI document assembly / `openapi.json` generator
  - `src/asyncapi/` – AsyncAPI document assembly / `asyncapi.json` generator (Eventhub Connect / MQTT)
  - `src/utils/` – Shared utilities (Pub/Sub, Datastore, Firebase, plugins)
  - `cli/` – Command-line utilities
  - `config/` – Configuration files
  - `integration/` – Hurl HTTP suite (`ingest-api.hurl`) mirroring `src/ingest/server.test.ts` (run with `just integration`)
  - `docs/` – Documentation (Markdown, built with Blume)
  - `blume.config.ts` – Docs site configuration
  - `tests/` – Test files (co-located with source files using `.test.ts`)

## Code Style

Follow SWR Audio Lab engineering principles:

- **Language:** Use English for filenames, variables, comments, and documentation
- **Formatting:** Oxfmt handles formatting (single quotes, no semicolons, tabs for indentation, 120 char line width)
- **TypeScript:** Strict mode enabled, prefer explicit types over inference where it improves clarity
- **Naming:** Use descriptive, clear names. Follow existing patterns in the codebase
- **Comments:** Include inline comments for complex logic, but prefer self-documenting code

## Testing

- All code changes should include or update tests
- Tests use [`@cross/test`](https://jsr.io/@cross/test) with [`@std/assert`](https://jsr.io/@std/assert) (and [sinon](https://sinonjs.org/) for stubs/spies) so they run on Bun, Node, or Deno
- Test files are co-located with source files (`.test.ts` extension)
- Run with `just test` (Bun via sops env) or `bun test`; Node/Deno: `node --import tsx --test` / `deno test` against the same files
- Tests must pass before merging PRs

## Git Workflow

- **Commits:** Follow [Conventional Commits](https://www.conventionalcommits.org/) format (`feat:`, `fix:`, `docs:`, etc.)
- **Signing:** Commits must be signed (SSH or GPG)
- **Branches:** Use `dev/*` or `feature/*` for development branches. Only `main` deploys to production
- **PRs:** Run `just test` and `just lint` before opening a PR

## Boundaries

- ✅ **Always do:** Write tests for new code, run linter before committing, use English for code/docs, follow existing patterns, run `just openapi` after changing `package.json` version (keeps `openapi.json` and `asyncapi.json` in sync)
- ⚠️ **Ask first:** Modifying Google Cloud configuration, changing authentication flows, updating dependencies, major architectural changes
- 🚫 **Never do:** Commit unencrypted secrets or API keys (use Secret Manager), modify `node_modules/` or `bun.lock`, remove failing tests without fixing them, use German in code/comments

## Documentation

- Write documentation in Markdown files in the `docs/` directory
- Keep documentation clear, concise, and practical
- Update documentation when changing functionality
- Use the existing documentation structure as a guide

## Security

- Never commit unencrypted secrets, API keys, or credentials
- Use Google Cloud Secret Manager for sensitive data
- Check `.env.example` for required environment variables
- All secrets should be GPG- or age-encrypted (using sops) if shared

## Dependencies

- Use `bun install` to add dependencies
- Keep dependencies up-to-date for security patches
- Test thoroughly after dependency upgrades
- Check license compatibility (project uses EUPL-1.2)
