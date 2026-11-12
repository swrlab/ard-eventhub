---
title: 'Firewall'
description: 'SWR firewall form values for the three Eventhub Connect hosts.'
sidebar:
  icon: brick-wall-shield
---

Server numbers are the `server` values in [`infra/nixos/hosts.toml`](https://github.com/swrlab/ard-eventhub/blob/main/infra/nixos/hosts.toml). The three stage names of one machine resolve to the same host. Cluster routes, MQTT, WebSocket, and the operator UI use the `.swr.cn.ard.de` name.

## Broadcasters

A house connects outbound from the ARD CN only. There is no internet endpoint and no inbound port on the house side. Each house arranges its own ARD CN access through the ARD process.

The house opens TCP to the three MQTT names below: prod `8883`, test `18883`. TLS verification uses the CA PEM shipped with the credentials. All three names go in the client. When the test servers are ready is covered under [Stages](./stages).

## Requests

Each block is one request: every FQDN under it is a source, a destination, or both. A block with more than one port stays one request when the form accepts several ports. With a single port field, file that block once per port and keep all three names on it.

### 1. Outbound HTTPS — hosts to internet

TCP `443`. Destination empty. Source FQDN is `<server-number>.swr.ard` for each host in [`infra/nixos/hosts.toml`](https://github.com/swrlab/ard-eventhub/blob/main/infra/nixos/hosts.toml).

Needed for NixOS, images, `ARD_FEED_URL`, Radioplayer (`np-ingest.radioplayer.cloud`), and DTS. Same rule as [NixOS Install](./nixos-install).

### 2. NATS cluster — host to host, bidirectional

Same list as source and as destination. TCP.

**prod `6222`**

- `eventhub-connect-bad-prod.swr.ard`
- `eventhub-connect-mnz-prod.swr.ard`
- `eventhub-connect-stg-prod.swr.ard`

**test `16222`**

- `eventhub-connect-bad-test.swr.ard`
- `eventhub-connect-mnz-test.swr.ard`
- `eventhub-connect-stg-test.swr.ard`

**dev `26222`**

- `eventhub-connect-bad-dev.swr.ard`
- `eventhub-connect-mnz-dev.swr.ard`
- `eventhub-connect-stg-dev.swr.ard`

### 3. MQTT TLS — ARD CN to hosts

Source empty (ARD CN). Destinations below. TCP.

**prod `8883`**

- `eventhub-connect-bad-prod.swr.cn.ard.de`
- `eventhub-connect-mnz-prod.swr.cn.ard.de`
- `eventhub-connect-stg-prod.swr.cn.ard.de`

**test `18883`**

- `eventhub-connect-bad-test.swr.cn.ard.de`
- `eventhub-connect-mnz-test.swr.cn.ard.de`
- `eventhub-connect-stg-test.swr.cn.ard.de`

**dev `28883`**

- `eventhub-connect-bad-dev.swr.cn.ard.de`
- `eventhub-connect-mnz-dev.swr.cn.ard.de`
- `eventhub-connect-stg-dev.swr.cn.ard.de`

### 4. NATS WebSocket TLS — ARD CN to hosts

Source empty (ARD CN). Same destinations as MQTT. TCP.

- **prod** `9222`
- **test** `19222`
- **dev** `29222`

### 5. Operator UI — ARD CN to hosts

Source empty (ARD CN). Same destinations as MQTT. TCP `443` for every stage. The hostname selects the stage.

### 6. Beszel agent — host to host, bidirectional

Same list as source and as destination. TCP `45876`. The hub on each machine polls the agent on every machine.

- `<server-number>.swr.ard` for each host in [`infra/nixos/hosts.toml`](https://github.com/swrlab/ard-eventhub/blob/main/infra/nixos/hosts.toml)

### 7. Beszel hub UI — ARD CN to hosts

Source empty (ARD CN). TCP `8081`. Destination `<server-number>.swr.ard` for each host in [`infra/nixos/hosts.toml`](https://github.com/swrlab/ard-eventhub/blob/main/infra/nixos/hosts.toml).

### 8. Registry TLS — workstations to hosts

Source: the workstations that push images. TCP `5000`. Destinations:

- `eventhub-connect-bad-dev.swr.ard`
- `eventhub-connect-mnz-dev.swr.ard`
- `eventhub-connect-stg-dev.swr.ard`
