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
- 🚫 **Never do:** Commit secrets or API keys (use Secret Manager), modify `node_modules/` or `bun.lock`, remove failing tests without fixing them, use German in code/comments

## Documentation

- Write documentation in Markdown files in the `docs/` directory
- Keep documentation clear, concise, and practical
- Update documentation when changing functionality
- Use the existing documentation structure as a guide

## Security

- Never commit secrets, API keys, or credentials
- Use Google Cloud Secret Manager for sensitive data
- Check `.env.example` for required environment variables
- All secrets should be GPG-encrypted if shared

## Dependencies

- Use `bun install` to add dependencies
- Keep dependencies up-to-date for security patches
- Test thoroughly after dependency upgrades
- Check license compatibility (project uses EUPL-1.2)
