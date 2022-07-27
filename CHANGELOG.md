# ARD-Eventhub / Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.7] - 2022-07-25

- chore:
  - update Node to `v18`
  - update node-utils to `v1.0.0`
- fix:
  - resolve eslint errors
  - reorder core-dump (alphabetically institutions)
- feat:
  - update docker version tag from `package.json`
  - add eslint check to github-actions

## [1.3.6] - 2022-07-18

- chore: add publisherId to logs

## [1.3.5] - 2022-06-21

- security:
  - fix `CVE-2022-24434`
  - fix `CVE-2022-32210`
  - fix `CVE-2022-33987`
- update:
  - github-actions to use latest versions
  - @google-cloud/secret-manager to `v4.0.0`
  - @google-cloud/datastore to `v7.0.0`
  - firebase-admin to `v11.0.0`
- use node-crc from `@swrlab/utils`

## [1.3.4] - 2022-06-07

- security: fix `CVE-2022-25878`
- update:
  - actions/setup-node to `v3.2.0`
  - @google-cloud/pubsub to `v3.0.1`

## [1.3.3] - 2022-05-10

- add: BR channel `BR Heimat`
- update:
  - dd-trace to `v2.7.0`
  - google-auth-library to `v8.0.2`

## [1.3.2] - 2022-05-03

- chore: update Node to `v16.15`
- fix: require service-name
- update:
  - mocha to `v10.0.0`
  - /create-or-update-comment to `v2.0.0`

## [1.3.1] - 2022-04-26

- add: SR channels
  - `UNSERDING` and `AntenneSaar`
- security: fix `CVE-2022-24785`
- update: github actions
  - /checkout to `v3.0.2`
  - /setup-node to `v3.1.1`
  - /setup-gcloud to `v0.6.0`

## [1.3.0] - 2022-03-28

- chore: update Node to `v16.14.2`
- chore: change name of `Dockerfile`
- chore: update node-crc to `v2`
- add: `rustup` to build process
- fix: `setup-gcloud` default branch
- security: fix `CVE-2021-44906`

## [1.2.9] - 2022-03-17

- add: new deploy-process for prod
- chore: remove `eslint-plugin-swr`
- chore: update peer-dependencies
- security: fix `CVE-2022-24772`

## [1.2.8] - 2022-03-15

- chore: update checkout to `v3`
- chore: update dependencies

## [1.2.7] - 2022-03-01

- security: fix `CVE-2022-23647`
- chore: update setup-node to `v3`
- chore: update dependencies

## [1.2.6] - 2022-02-14

- chore: update Node to `v16.14`
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
- Fix for `GHSA-qrmm-w75w-3wpx`
- Update Node to `v16.13.1`
- Update project dependencies

## [1.2.2] - 2021-11-30

- Add two missing MDR channels
- Update project dependencies
- Update github actions

## [1.2.1] - 2021-11-16

- Update project dependencies
- Update github actions

## [1.2.0] - 2021-10-19

- Update Node to [v16.11.1](https://nodejs.org/en/blog/vulnerability/oct-2021-security-releases/)
- Update project dependencies
- Update to `python3` in docker
- Swap `node-fetch` for `undici-wrapper`
- Update remaining `console` logs to `logger`
- Update dotenv and config

## [1.1.5] - 2021-09-27

- Fix for `SNYK-JS-ANSIREGEX-1583908`
- Update project dependencies
- Update github actions

## [1.1.4] - 2021-09-13

- Update project dependencies

## [1.1.3] - 2021-07-27

- Update project dependencies

## [1.1.2] - 2021-07-20

- Fix for `dev` and `beta` deployment
- Update project dependencies

## [1.1.1] - 2021-06-30

- Fix for CVE-2021-32723
- Update project dependencies
- Remove deprecated body-parser

## [1.1.0] - 2021-06-01

- Add first external plugin with dts-integration

## [1.0.2] - 2021-05-19

- Minor fixes in Readme and Docs
- Update the OpenAPI specification

## [1.0.1] - 2021-05-10

- Fixes for CVE-2021-27515 and CVE-2021-23362
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
