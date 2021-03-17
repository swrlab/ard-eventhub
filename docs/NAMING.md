# ARD-Eventhub / Naming Conventions

Several parts of this service require naming conventions that are followed throughout all parts.  

- [ARD-Eventhub / Naming Conventions](#ard-eventhub--naming-conventions)
  - [Google Cloud Pub/Sub](#google-cloud-pubsub)
  - [Pub/Sub Topics](#pubsub-topics)
  - [Pub/Sub Subscriptions](#pubsub-subscriptions)

## Google Cloud Pub/Sub

Pub/Sub includes a number of restrictions around names, keys and values. For all parts (module, stage, serviceId, etc.), there are some defined rules:

- Keys other than `stage` must never include any value of a staging environment (e.g. `service` cannot include `prod`)
- All values are always written in lower-case characters, without any special chars such as äöü.
  - This service uses a slug converter to turn user-defined institution names into usable but still readable strings
- Google restrictions for IDs:
  - Must be 3-255 characters, start with a letter, and contain only the following characters: letters, numbers, dashes (-), periods (.), underscores (_), tildes (~), percents (%) or plus signs (+). Cannot start with goog.

## Pub/Sub Topics

```txt
<domain-prefix> . <service> . <module>  . <stage> . <service-id>
     de.ard     . eventhub  . publisher .   swr   .  284680

=> de.ard.eventhub.publisher.dev.284680
```

## Pub/Sub Subscriptions

```txt
<domain-prefix> . <service> . <module>     . <stage> . <institution> . <uid>
     de.ard     . eventhub  . subscription .   dev   .      swr      . 9bdb9316-c78a-4ebe-a131-30b2738435a3

=> de.ard.eventhub.subscription.dev.swr.9bdb9316-c78a-4ebe-a131-30b2738435a3
```
