# ARD-Eventhub

ARD system to distribute real-time (live) metadata for primarily radio broadcasts. During development, please head over to [./issues](https://github.com/swrlab/ard-eventhub/issues) and [./discussions](https://github.com/swrlab/ard-eventhub/discussions) for current topics and updates.

## Get involved

- Join [./discussions](https://github.com/swrlab/ard-eventhub/discussions)
- Join _#eventhub_ in the ARD Entwickler Slack

## Changelog

A separate Changelog will be available in [CHANGELOG.md](CHANGELOG.md)

## Modules

This project will include two modules: Ingest and API. The first development step is to only supply the Ingest service. Each module uses their own endpoints and checks, while some parts are shared across both (`utils`). They also both have their own Dockerfiles to start the appropriate service.

### Ingest

The Ingest service is responsible for receiving and publishing events and managing subscriptions. You'll find the core code in [`./src/ingest/`](./src/ingest/).

## License

This project is licensed under **European Union Public License 1.2** ([`EUPL-1.2`](https://spdx.org/licenses/EUPL-1.2.html)), which can be found in [LICENSE.txt](LICENSE.txt). Detailed information and translations to all 23 official languages of the European Union are available at [joinup.ec.europa.eu](https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12). The usage of this license does not imply any relationship to or endorsement by the European Union, the joinup initiative or other participating parties.  
A [compatibility matrix](https://joinup.ec.europa.eu/collection/eupl/matrix-eupl-compatible-open-source-licences) is also available and describes the relationships between EUPL-1.2 in upstream and downstream projects.  

This source code is provided under EUPL v1.2, except for the [`spdx-exceptions`](https://www.npmjs.com/package/spdx-exceptions) package, which uses the `CC-BY-3.0` license, without adding any legal or technical restrictions guaranteed by their license.  

## Third-Party Components

| Type    | Name                          | License                                                                                   |
| ------- | ----------------------------- | ----------------------------------------------------------------------------------------- |
| Docker  | `node:14.15-alpine`           | [MIT](https://github.com/nodejs/node/blob/master/LICENSE)                                 |
| NPM     | `@google-cloud/datastore`     | [Apache License 2.0](https://github.com/googleapis/nodejs-datastore/blob/master/LICENSE)  |
| NPM     | `@google-cloud/pubsub`        | [Apache License 2.0](https://github.com/googleapis/nodejs-pubsub/blob/master/LICENSE)     |
| NPM     | `body-parser`                 | [MIT](https://github.com/expressjs/body-parser/blob/master/LICENSE)                       |
| NPM     | `compression`                 | [MIT](https://github.com/expressjs/compression/blob/master/LICENSE)                       |
| NPM     | `dd-trace`                    | [Apache-2.0 OR BSD-3-Clause](https://github.com/DataDog/dd-trace-js/blob/master/LICENSE)  |
| NPM     | `express`                     | [MIT](https://github.com/expressjs/express/blob/master/LICENSE)                           |
| NPM     | `express-openapi-validator`   | [MIT](https://github.com/cdimascio/express-openapi-validator/blob/master/LICENSE)         |
| NPM     | `firebase-admin`              | [Apache License 2.0](https://github.com/firebase/firebase-admin-node/blob/master/LICENSE) |
| NPM     | `jsonwebtoken`                | [MIT](https://github.com/auth0/node-jsonwebtoken/blob/master/LICENSE)                     |
| NPM     | `moment`                      | [MIT](https://github.com/moment/moment/blob/develop/LICENSE)                              |
| NPM     | `node-fetch`                  | [MIT](https://github.com/node-fetch/node-fetch/blob/master/LICENSE.md)                    |
| NPM     | `swagger-ui-express`          | [MIT](https://github.com/scottie1984/swagger-ui-express/blob/master/LICENSE)              |
| NPM DEV | `@swrlab/swr-prettier-config` | [ISC](https://github.com/swrlab/prettier-config/blob/main/license.md)                     |
| NPM DEV | `chai`                        | [MIT](https://github.com/chaijs/chai/blob/master/LICENSE)                                 |
| NPM DEV | `chai-http`                   | [MIT](https://github.com/chaijs/chai-http/blob/master/package.json)                       |
| NPM DEV | `eslint`                      | [MIT](https://github.com/eslint/eslint/blob/master/LICENSE)                               |
| NPM DEV | `eslint-plugin-swr`           | [ISC](https://github.com/swrlab/eslint-plugin-swr/blob/main/package.json)                 |
| NPM DEV | `license-compliance`          | [MIT](https://github.com/tmorell/license-compliance/blob/master/LICENSE)                  |
| NPM DEV | `mocha`                       | [MIT](https://github.com/mochajs/mocha/blob/master/LICENSE)                               |
| NPM DEV | `nodemon`                     | [MIT](https://github.com/remy/nodemon/blob/master/LICENSE)                                |
