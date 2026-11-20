---
title: 'Firewall'
description: 'SWR firewall form values. Each request lists source, destination, and ports.'
sidebar:
  icon: brick-wall-shield
---

One request is one form: source, destination, and ports. Names on `.swr.ard` are the internal hostnames. Names on `.swr.cn.ard.de` are what the ARD CN dials. Dev, test, and prod are the same three machines under different hostnames, so every stage name and every stage port go on the same request. Server numbers are the `server` values in [`infra/nixos/hosts.toml`](https://github.com/swrlab/ard-eventhub/blob/main/infra/nixos/hosts.toml):

- `s0006669.swr.ard` — eventhub-connect-bad
- `s0006663.swr.ard` — eventhub-connect-mnz
- `s0006670.swr.ard` — eventhub-connect-stg

A request with several ports stays one request when the form accepts several ports. With a single port field, file that request once per port and keep the same source and destination.

## Hosts to the internet

### Outbound HTTPS

**Source**

- `s0006669.swr.ard`
- `s0006663.swr.ard`
- `s0006670.swr.ard`

**Destination**

Leave empty. Any host on the internet.

**Ports**

- TCP `443`

NixOS, images, `ARD_FEED_URL`, Radioplayer, and DTS. Same rule as [NixOS Install](./nixos-install).

## Host to host

The same names go in source and in destination. Each machine dials the other two.

**Source**

- `eventhub-connect-{bad,mnz,stg}-{dev,test,prod}.swr.ard`

**Destination**

- `eventhub-connect-{bad,mnz,stg}-{dev,test,prod}.swr.ard`

**Ports**

- NATS cluster
  - TCP `26222` — dev
  - TCP `16222` — test
  - TCP `6222` — prod
- Beszel agent
  - TCP `45876`

## ARD CN to hosts

Leave the source empty. That covers the ARD CN. MQTT, the NATS WebSocket, and the operator UI share the `.swr.cn.ard.de` names. Port `443` is the operator UI on every stage; the hostname selects the stage.

### Connect

**Source**

Leave empty.

**Destination**

- `eventhub-connect-{bad,mnz,stg}-{dev,test,prod}.swr.cn.ard.de`

**Ports**

- TCP `443` — operator UI
- TCP `28883` — MQTT, dev
- TCP `18883` — MQTT, test
- TCP `8883` — MQTT, prod
- TCP `29222` — NATS WebSocket, dev
- TCP `19222` — NATS WebSocket, test
- TCP `9222` — NATS WebSocket, prod

## Workstations to hosts

**Source**

Local workstations.

**Destination**

- `eventhub-connect-{bad, mnz,stg}-dev.swr.ard`

**Ports**

- Beszel hub
  - TCP `8081`
- registry
  - TCP `5000`
- UI
  - TCP `443`
