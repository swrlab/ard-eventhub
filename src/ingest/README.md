# ARD Eventhub (Working Title)

## Ingest

The Ingest service is used to accept incoming events, distribute them via Pub/Sub and provide methods for users to manage their own subscriptions (self-service).  

### Environments

Designated host is Kubernetes but the Docker container will also be used in other environments such as Google Cloud Run for testing purposes.

It needs several environment variables to work:

- REQUIRED `STAGE`
- OPTIONAL `PORT` - override server port setting, default is 8080

### Stages

Some staging information is auto-detected (whether to run tracing or not), some is configured by the `STAGE` variable.

#### DEV

Main difference is the prefix used for Pub/Sub topics, which includes `DEV-`.

#### PROD

Uses full production prefixes and configuration.
