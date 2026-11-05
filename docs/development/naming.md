---
title: 'Naming Conventions'
description: 'Consistent names for Pub/Sub and services.'
sidebar:
  icon: user-round-pen
---

Several parts of this service need consistent naming conventions.

## Google Cloud Pub/Sub

Pub/Sub has limits on names, keys, and values. For all fields (module, stage, serviceId, and so on) the following rules apply among others:

- Keys other than `stage` must not contain a staging-environment value (for example, `service` must not contain `prod`)
- All values are lowercase and contain no special characters such as `äöü`.
  - This service uses a slug converter to turn institution names into usable, readable strings
- Google limits on IDs:
  - Must be 3–255 characters long, start with a letter, and may only contain letters, numbers, hyphens (-), periods (.), underscores (_), tildes (~), percent signs (%), or plus signs (+). Must not start with `goog`.

## Pub/Sub Topics

```txt
<domain-prefix> . <service> . <stage> . <encoded-core-id>
     de.ard     . eventhub  .   dev   . urn%3Aard%3Aper...

=> de.ard.eventhub.dev.urn%3Aard%3Apermanent-livestream%3Aa315d3e482f09e1b
```

## Pub/Sub Subscriptions

```txt
<domain-prefix> . <service> . <module>     . <stage> .   <uid>
     de.ard     . eventhub  . subscription .   dev   . 9bdb9316-c78a-4ebe-a131-30b2738435a3

=> de.ard.eventhub.subscription.dev.9bdb9316-c78a-4ebe-a131-30b2738435a3
```
