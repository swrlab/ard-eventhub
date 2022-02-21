# ARD-Eventhub

ARD system to distribute real-time (live) metadata for primarily radio broadcasts.

- [ARD-Eventhub](#ard-eventhub)
  - [Active Data Suppliers](#active-data-suppliers)
  - [Get Started and Documentation](#get-started-and-documentation)
  - [Get involved](#get-involved)
  - [Modules](#modules)
    - [Ingest](#ingest)
  - [Changelog](#changelog)
  - [License](#license)
  - [Third-Party Components](#third-party-components)
  - [Authors](#authors)

## Active Data Suppliers

These ARD broadcasters are currently sending live metadata via ARD Eventhub:

| Broadcaster      | TEST | PROD |
| ---------------- | ---- | ---- |
| BR               | -    | -    |
| HR               | ✅    | ⌛️    |
| MDR              | ✅    | ✅    |
| NDR              | ✅    | ✅    |
| Radio Bremen     | ✅    | ✅    |
| RBB              | -    | -    |
| SR               | -    | -    |
| SWR              | ✅    | ✅    |
| WDR              | ✅    | ⌛️    |
| Deutschlandradio | -    | -    |

## Get Started and Documentation

Important places to go ahead:

- The [ard-eventhub](https://github.com/swrlab/ard-eventhub) repository
- Our [Quickstart](docs/QUICKSTART.md) documentation
- The full docs on [swrlab.github.io/ard-eventhub](https://swrlab.github.io/ard-eventhub/)
- OpenAPI specification on [eventhub-ingest.ard.de/openapi](https://eventhub-ingest.ard.de/openapi)
- Internal documentation in [Confluence](https://confluence.ard.de/x/4AmgDw)

## Get involved

- Open an [issue](https://github.com/swrlab/ard-eventhub/issues) for problems, that you might experience
- Join [ard-eventhub/discussions](https://github.com/swrlab/ard-eventhub/discussions) for ongoing topics about formats, etc.
- Join _#eventhub_ in the _ARD Entwickler_ Slack

## Modules

This project will include two modules: Ingest and API. The first development step is to only supply the Ingest service. Each module uses their own endpoints and checks, while some parts are shared across both (`utils`). They also both have their own Dockerfiles to start the appropriate service.

### Ingest

The Ingest service is responsible for receiving and publishing events and managing subscriptions. You'll find the core code in [`./src/ingest/`](./src/ingest/).

## Changelog

See [CHANGELOG](CHANGELOG.md) for latest changes.

## License

This project is licensed under **European Union Public License 1.2** ([`EUPL-1.2`](https://spdx.org/licenses/EUPL-1.2.html)), which can be found in [LICENSE](LICENSE.txt). Detailed information and translations to all 23 official languages of the European Union are available at [joinup.ec.europa.eu](https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12). The usage of this license does not imply any relationship to or endorsement by the European Union, the joinup initiative or other participating parties.  
A [compatibility matrix](https://joinup.ec.europa.eu/collection/eupl/matrix-eupl-compatible-open-source-licences) is also available and describes the relationships between EUPL-1.2 in upstream and downstream projects.

This source code is provided under EUPL v1.2, except for the [`spdx-exceptions`](https://www.npmjs.com/package/spdx-exceptions) package, which uses the `CC-BY-3.0` license, without adding any legal or technical restrictions guaranteed by their license.

## Third-Party Components

| Type    | Name                           | License                                                                                            |
| ------- | ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Docker  | `node:16.14-alpine`            | [MIT](https://github.com/nodejs/node/blob/master/LICENSE)                                          |
| NPM     | `@google-cloud/datastore`      | [Apache License 2.0](https://github.com/googleapis/nodejs-datastore/blob/master/LICENSE)           |
| NPM     | `@google-cloud/pubsub`         | [Apache License 2.0](https://github.com/googleapis/nodejs-pubsub/blob/master/LICENSE)              |
| NPM     | `@google-cloud/secret-manager` | [Apache License 2.0](https://github.com/googleapis/nodejs-secret-manager/blob/master/LICENSE)      |
| NPM     | `@swrlab/utils`                | [Hippocratic 2.0](https://github.com/swrlab/node-utils/blob/main/LICENSE.md)                       |
| NPM     | `compression`                  | [MIT](https://github.com/expressjs/compression/blob/master/LICENSE)                                |
| NPM     | `dd-trace`                     | [Apache-2.0 OR BSD-3-Clause](https://github.com/DataDog/dd-trace-js/blob/master/LICENSE)           |
| NPM     | `express`                      | [MIT](https://github.com/expressjs/express/blob/master/LICENSE)                                    |
| NPM     | `express-openapi-validator`    | [MIT](https://github.com/cdimascio/express-openapi-validator/blob/master/LICENSE)                  |
| NPM     | `firebase-admin`               | [Apache License 2.0](https://github.com/firebase/firebase-admin-node/blob/master/LICENSE)          |
| NPM     | `google-auth-library`          | [Apache License 2.0](https://github.com/googleapis/google-auth-library-nodejs/blob/master/LICENSE) |
| NPM     | `jsonwebtoken`                 | [MIT](https://github.com/auth0/node-jsonwebtoken/blob/master/LICENSE)                              |
| NPM     | `moment`                       | [MIT](https://github.com/moment/moment/blob/develop/LICENSE)                                       |
| NPM     | `node-crc`                     | [MIT](https://github.com/magiclen/node-crc/blob/master/LICENSE)                                    |
| NPM     | `slug`                         | [MIT](https://github.com/Trott/slug/blob/master/LICENSE)                                           |
| NPM     | `swagger-ui-express`           | [MIT](https://github.com/scottie1984/swagger-ui-express/blob/master/LICENSE)                       |
| NPM     | `uuid`                         | [MIT](https://github.com/uuidjs/uuid/blob/master/LICENSE.md)                                       |
| NPM     | `winston`                      | [MIT](https://github.com/winstonjs/winston/blob/master/LICENSE)                                    |
| NPM DEV | `@swrlab/eslint-plugin-swr`    | [ISC](https://github.com/swrlab/eslint-plugin-swr/)                                                |
| NPM DEV | `@swrlab/swr-prettier-config`  | [ISC](https://github.com/swrlab/prettier-config/blob/main/license.md)                              |
| NPM DEV | `chai`                         | [MIT](https://github.com/chaijs/chai/blob/master/LICENSE)                                          |
| NPM DEV | `chai-http`                    | [MIT](https://github.com/chaijs/chai-http/blob/master/package.json)                                |
| NPM DEV | `docsify-cli`                  | [MIT](https://github.com/docsifyjs/docsify-cli/blob/master/LICENSE)                                |
| NPM DEV | `dotenv`                       | [BSD-2-Clause](https://github.com/motdotla/dotenv/blob/master/LICENSE)                             |
| NPM DEV | `eslint`                       | [MIT](https://github.com/eslint/eslint/blob/master/LICENSE)                                        |
| NPM DEV | `eslint-plugin-chai-friendly`  | [MIT](https://github.com/ihordiachenko/eslint-plugin-chai-friendly/blob/master/LICENSE)            |
| NPM DEV | `eslint-plugin-swr`            | [ISC](https://github.com/swrlab/eslint-plugin-swr/blob/main/package.json)                          |
| NPM DEV | `license-compliance`           | [MIT](https://github.com/tmorell/license-compliance/blob/master/LICENSE)                           |
| NPM DEV | `mocha`                        | [MIT](https://github.com/mochajs/mocha/blob/master/LICENSE)                                        |
| NPM DEV | `nodemon`                      | [MIT](https://github.com/remy/nodemon/blob/master/LICENSE)                                         |
| NPM DEV | `prettier`                     | [MIT](https://github.com/prettier/prettier/blob/main/LICENSE)                                      |

## Authors

This project was realized by

- [Daniel Freytag](https://github.com/frytg)
- [Rafael Mäuer](https://github.com/rafaelmaeuer)
- [Christian Hufnagel](https://github.com/chhufnagel)
