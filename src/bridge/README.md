# ARD Eventhub Bridge

Dumb GCP→CN relay. Subscribes to MQTT `inbox/#` on the ingest hop (NanoMQ / GCP broker) and republishes the **same topic and bytes** to the CN MQTT gateway as `svc-bridge` — the same path a migrated publisher uses. No validation, no fan-out, no payload rewrite.

`svc-bridge` is MQTT-only and may publish every `inbox.>`. The NATS MQTT gateway turns `inbox/{institutionId}` into `inbox.{institutionId}`.

Do not import `#env`. Bridge reads its own vars from [`env.ts`](env.ts).

If the bridge should be off, do not deploy or run it. Keep one replica so events are not relayed twice. It can run on any node.

## Environment

- OPTIONAL `MQTT_BROKER_URL` — GCP / NanoMQ hop, default `mqtt://127.0.0.1:1883`
- OPTIONAL `MQTT_TLS_CA` — hop CA PEM or path (mqtts://)
- OPTIONAL `CN_MQTT_URL` — CN MQTT gateway, default `mqtt://127.0.0.1:1883`
- OPTIONAL `CN_MQTT_TLS_CA` — CN gateway CA PEM or path
- OPTIONAL `NATS_USER` — default `svc-bridge`
- OPTIONAL `NATS_PASSWORD` — default `local`

GCP `clientId` is `eventhub-bridge`; CN is `eventhub-bridge-cn`. A second GCP session with the same id is taken over by the hop.

NanoMQ and the local NATS MQTT gateway both bind `:1883`. On one machine, run the hop **or** NATS, not both. Two-host setup: hop on one, CN MQTT on the other.

## Local

```sh
just mqtt-up            # GCP stand-in on :1883 (stop NATS first)
# other host / other network:
just nats-up            # CN MQTT :1883 / NATS :4222
just bridge
```

Lag (`lagMs` since last relay, `lastRelayLatencyMs` per hop) is logged every 30s as `bridge lag`.
