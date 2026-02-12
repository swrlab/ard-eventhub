# ARD Eventhub / Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.1] - 2026-02-12

- fix: only run radioplayer in non-prod or when requested
- fix: only post dts and radioplayer queues for now playing events

## [2.3.0] - 2026-02-10

- fix: ignore blocked services in common topic
- feat: add radioplayer plugin
- feat: add sops encryption logic

## [2.2.0] - 2026-02-05

- feat: add optional `isFallback` flag to media elements to mark fallback content

## [2.1.2] - 2025-11-27

- feat: enforce endpoint standards
- chore: translate docs into german
- chore: make docs more approachable

## [2.1.1] - 2025-11-27

- fix: temporary publisher mapping for the ARD feed during the migration period
- chore: update dependencies

## [2.1.0] - 2025-11-04

- fix: prevent multiple downloads of the ard feed
- fix: proper publisher lookup
- refact: replace logger import
- refact: migrate tests from jest to `bun:test`
- chore: allow higher expired offset for events

## [2.0.2] - 2025-10-28

- fix: change dockerfile to use bun instead of node

## [2.0.1] - 2025-10-28

- chore: redeploy

## [2.0.0] - 2025-10-16

- refactor: use bun with typescript instead of javascript and node
- refactor: use bun instead of npm to test
- fix: retrieve the feed at the application start
- chore: rename application version

## [1.10.2] - 2025-03-13

- feat: use ard feed api for livestreams, publishers and institutions instead of a local file

## [1.10.1] - 2025-02-21

- chore: remove event duplication for service migrations

## [1.10.0] - 2025-01-07

- refactor: change new radio text event description and sophora tag
- feat: add new radio text event

## [1.9.3] - 2025-01-23

- fix: update publisher `radio3`
- chore: migrate to Bun text lockfile

## [1.9.2] - 2024-10-28

- feat: stop storing the message in the datastore

## [1.9.1] - 2024-09-04

- chore: apply linter suggestions
- feat: add more event duplication IDs

## [1.9.0] - 2024-08-19

- feat: enable event duplication for service migrations

## [1.8.1] - 2024-07-23

- feat: extend contributor roles

## [1.8.0] - 2024-06-26

- chore: upgrade to Node.js v22
- feat: switch subscription names from UUIDv4 to ULID
- chore: swap yarn for bun (package manager only)
- chore: swap eslint for biome (experimental)
- chore: remove table of contents from docs
- chore: add docs about plugins
- chore: add docs about pubsub defaults

## [1.7.3] - 2024-04-23

- chore: updated lots of dependencies

## [1.7.2] - 2023-12-18

- feat: activate `dts` plugin for all institutions

## [1.7.1] - 2023-12-12

- feat: added allow list by institution for `dts` plugin

## [1.7.0] - 2023-10-27

- refactor: drop `contentId` mapping from `dts` plugin

## [1.6.0] - 2023-09-22

- feat: prepare feature flat to toggle `dts` plugin to be opt-out
- feat: add common pubsub topic
- refactor: migrate DTS APIs

## [1.5.2] - 2023-08-08

- fix: replace docker-scan with docker-scout
- fix: remove data from bad-request response
- chore: update dd-trace to `v4`
- chore: update license-compliance to `v2`

## [1.5.1] - 2023-04-04

- feat: add `references` to external broadcast series and shows

## [1.5.0] - 2023-03-14

- fix: stop logging requests on dev
- fix: spelling of `SWR Audio Lab`
- fix: handle invalid format definition
- feat: add `IS_LOCAL` env for local-specific logs and actions
- feat: enable multiple user accounts for DTS plugin
- feat: add test for invalid timestamps
- feat: add custom attributes to pubsub messages
- refactor: move DTS keys from GCP Secrets to env
- refactor: move some event functions to utils
- refactor: replace `moment` with `luxon`
- refactor: remove info logging for sent pubsub events

## [1.4.1] - 2022-12-23

- chore: update `jsonwebtoken` to mitigate CVE-2022-23529

## [1.4.0] - 2022-11-24

- chore: update `express-openapi-validator` to `v5`
- chore: update `google-github-actions` to `v1`
- chore: refactor env check and add google-auth
- chore: add env var checks to mocha-tests
- chore: migrate GitHub Actions from `::set-output` to new format
- chore: migrate to new `google-github-actions/auth` authentication
- fix: decouple logger init from config loading

## [1.3.9] - 2022-10-04

- chore: update dd-trace to `v3`
- chore: update slug to `v8`
- chore: update uuid to `v9`

## [1.3.8] - 2022-08-22

- chore: code-format and linting
- chore: update node-dependencies
- feat: license-compliance with js

## [1.3.7] - 2022-07-25

- chore: update Node.js to `v18`
- chore: update node-utils to `v1.0.0`
- fix: resolve ESLint errors
- fix: reorder core-dump (alphabetically institutions)
- feat: update docker version tag from `package.json`
- feat: add ESLint check to GitHub Actions

## [1.3.6] - 2022-07-18

- chore: add publisherId to logs

## [1.3.5] - 2022-06-21

- update: GitHub Actions to use latest versions
- update: @google-cloud/secret-manager to `v4.0.0`
- update: @google-cloud/datastore to `v7.0.0`
- update: firebase-admin to `v11.0.0`
- use node-crc from `@swrlab/utils`

## [1.3.4] - 2022-06-07

- update: actions/setup-node to `v3.2.0`
- update: @google-cloud/pubsub to `v3.0.1`

## [1.3.3] - 2022-05-10

- add: BR channel `BR Heimat`
- update: dd-trace to `v2.7.0`
- update: google-auth-library to `v8.0.2`

## [1.3.2] - 2022-05-03

- chore: update Node.js to `v16.15`
- fix: require service-name
- update: mocha to `v10.0.0`
- update: /create-or-update-comment to `v2.0.0`

## [1.3.1] - 2022-04-26

- add: SR channels `UNSERDING` and `AntenneSaar`
- update: actions/checkout to `v3.0.2`
- update: actions/setup-node to `v3.1.1`
- update: actions/setup-gcloud to `v0.6.0`

## [1.3.0] - 2022-03-28

- chore: update Node.js to `v16.14.2`
- chore: change name of `Dockerfile`
- chore: update node-crc to `v2`
- add: `rustup` to build process
- fix: `setup-gcloud` default branch

## [1.2.9] - 2022-03-17

- add: new deploy-process for prod
- chore: remove `eslint-plugin-swr`
- chore: update peer-dependencies

## [1.2.8] - 2022-03-15

- chore: update checkout to `v3`
- chore: update dependencies

## [1.2.7] - 2022-03-01

- chore: update setup-node to `v3`
- chore: update dependencies

## [1.2.6] - 2022-02-14

- chore: update Node.js to `v16.14`
- chore: update dependencies
- replace `undici-wrapper` with `@swrlab/utils`

## [1.2.5] - 2022-01-31

- Add: Bremen NEXT channel
- Fix: IDs of new MDR channels

## [1.2.4] - 2022-01-24

- chore: update dependencies
- chore: update README
- Rename NDR `Plus` to `Schlager`

## [1.2.3] - 2021-12-13

- Fix IDs of two MDR channels
- Update Node.js to `v16.13.1`
- Update project dependencies

## [1.2.2] - 2021-11-30

- Add two missing MDR channels
- Update project dependencies
- Update GitHub Actions

## [1.2.1] - 2021-11-16

- Update project dependencies
- Update GitHub Actions

## [1.2.0] - 2021-10-19

- Update Node.js to [v16.11.1](https://nodejs.org/en/blog/vulnerability/oct-2021-security-releases/)
- Update project dependencies
- Update to `python3` in docker
- Swap `node-fetch` for `undici-wrapper`
- Update remaining `console` logs to `logger`
- Update dotenv and config

## [1.1.5] - 2021-09-27

- Update project dependencies
- Update GitHub Actions

## [1.1.4] - 2021-09-13

- Update project dependencies

## [1.1.3] - 2021-07-27

- Update project dependencies

## [1.1.2] - 2021-07-20

- Fix for `dev` and `beta` deployment
- Update project dependencies

## [1.1.1] - 2021-06-30

- Update project dependencies
- Remove deprecated body-parser

## [1.1.0] - 2021-06-01

- Add first external plugin with dts-integration

## [1.0.2] - 2021-05-19

- Minor fixes in Readme and Docs
- Update the OpenAPI specification

## [1.0.1] - 2021-05-10

- Update project dependencies

## [1.0.0] - 2021-04-09

- Fixes in unit tests
- Fixes events checks and errors
- Update project dependencies
- Update OpenApi Docs

## [1.0.0-beta2] - 2021-03-25

- Add trailing 0 in service publisher-ids if number is only 5 digits

## [1.0.0-beta1] - 2021-03-24

🚧 BREAKING CHANGES for `serviceIds` 🚧

- New detailed return output when posting events for each service (`published`, `blocked`, `failed`)
- Improved log output in JSON format for better monitoring
- Now using `services` with required fields `type`, `externalId` and `publisherId` to identify a publishers' channel
- No longer using `serviceIds` as required identification keys
- `event` in the POST body for new events is now called `name` and is no longer required
  - variable is inserted using the event name provided by the URL

## [0.1.7] - 2021-03-23

- Add auth verification for unit tests
- Check `content-type` in unit tests
- Update unit tests for new ESLint config

## [0.1.6] - 2021-03-18

- Allow optional fields in POST /events to be `null`
- Remove field `isInternal` from POST /events

## [0.1.5] - 2021-03-17

- Preventing errors when `institution.name` isn't properly set in the user account
- Enforcing separation between dev/prod topics and subscriptions
- New onboarding and naming docs

## [0.1.4] - 2021-03-17

- Removed `attribution` from required media fields of new events
- Added OpenAPI documentation to the docs
- Update codebase with new ESLint config
- Add necessary ESLint exceptions for project

## [0.1.3] - 2021-03-16

- Hotfix `content-type` bug for error responses
- Updated endpoint structure for `/events`
- Changed order in test.ingest to check topics first, then subscriptions

## [0.1.2] - 2021-03-16

- First deployed prototype
