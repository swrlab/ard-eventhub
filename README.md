# ARD Eventhub (Working Title)

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
