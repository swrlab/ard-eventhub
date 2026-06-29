# AGENTS.md

Instructions for AI coding agents working on ARD Eventhub.

## Project Overview

ARD Eventhub is a system to distribute real-time (live) metadata for primarily radio broadcasts. It uses Bun as the runtime and package manager, TypeScript for type safety, and Google Cloud services (Pub/Sub, Datastore, Secret Manager) for backend infrastructure.

## Setup Commands

- **Install dependencies:** `bun install`
- **Start ingest service:** `bun run ingest` (runs with hot reload)
- **Run tests:** `just test`
- **Lint code:** `just lint` (uses Biome)
- **Format code:** Biome handles formatting automatically

## Project Knowledge

- **Tech Stack:** Bun, Node.js, TypeScript (strict mode), Express.js, Google Cloud Platform
- **File Structure:**
  - `src/ingest/` – Ingest service (receives events, manages subscriptions)
  - `src/utils/` – Shared utilities (Pub/Sub, Datastore, Firebase, plugins)
  - `cli/` – Command-line utilities
  - `config/` – Configuration files
  - `docs/` – Documentation (Markdown)
  - `tests/` – Test files (co-located with source files using `.test.ts`)

## Code Style

Follow SWR Audio Lab engineering principles:

- **Language:** Use English for filenames, variables, comments, and documentation
- **Formatting:** Biome handles formatting (single quotes, no semicolons, tabs for indentation, 120 char line width)
- **TypeScript:** Strict mode enabled, prefer explicit types over inference where it improves clarity
- **Naming:** Use descriptive, clear names. Follow existing patterns in the codebase
- **Comments:** Include inline comments for complex logic, but prefer self-documenting code

## Testing

- All code changes should include or update tests
- Tests use Bun's built-in test runner
- Test files are co-located with source files (`.test.ts` extension)
- Run `just test` before committing changes
- Tests must pass before merging PRs

## Git Workflow

- **Commits:** Follow [Conventional Commits](https://www.conventionalcommits.org/) format (`feat:`, `fix:`, `docs:`, etc.)
- **Signing:** Commits must be signed (SSH or GPG)
- **Branches:** Use `dev/*` or `feature/*` for development branches. Only `main` deploys to production
- **PRs:** Run `just test` and `just lint` before opening a PR

## Boundaries

- ✅ **Always do:** Write tests for new code, run linter before committing, use English for code/docs, follow existing patterns
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

## Cursor Cloud specific instructions

Runtime is **Bun** (installed at `~/.bun`; the startup update script runs `bun install`). Standard commands live in `package.json`/`justfile` (see "Setup Commands" above); only the non-obvious caveats are noted here.

- **No emulators / no offline mode.** Pub/Sub, Datastore, and Firebase clients connect to **live Google Cloud**, and `ARD_FEED_URL` is an internal ARD endpoint (itself a secret). There is no `docker-compose` or local emulator wiring.
- **Secrets are not present in the cloud VM by default.** Real auth, event publishing, and the full test suite need `sops`-decrypted `.env.sops.yaml` (requires the age/PGP key) plus `TEST_USER`/`TEST_USER_PW`. Without them, `just test` and `bun test src/ingest/ingest.test.ts` fail at the env/secret gate, and GCP/Firebase-backed routes return 401/500. If you need these, ask the user to provide the secrets.
- **Runs without secrets:** `bun run lint`, and the two unit tests `bun test src/ingest/middleware/validationError.test.ts` and `bun test scripts/generate-openapi.test.ts`. `sops`/`just` are not installed by the update script.
- **Booting the server for a smoke test without secrets:** `src/ingest/index.ts` calls `getARDFeed()` at startup and `process.exit(1)`s if `ARD_FEED_URL` is unreachable; `config/index.ts`, `config/dts-keys.ts` (base64 JSON `DTS_KEYS`), and the radioplayer plugin (base64 JSON `RADIOPLAYER_API_KEYS`) are all validated/parsed at import. You can boot `bun run ingest` with placeholder env vars + a mock feed served locally (≥190 items including stations `WDR 2, WDR 4, 1LIVE, NDR 1 Niedersachsen, SWR3, NDR 2, BAYERN 1, SWR4 BW, hr3, hr4`) to exercise routing/middleware/Zod validation and the `/openapi` Swagger UI; backend-dependent routes will still 401/500.
