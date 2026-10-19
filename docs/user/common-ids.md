---
title: 'Allgemeine Service IDs'
description: 'Gemeinsame nächtliche Sendungen. In v3 ersetzen MQTT-Wildcards die Firehose.'
sidebar:
  order: 5
  icon: id-card
---

## Nächtliche Landesweite Sendungen

Einige Sender sind für die Bereitstellung von gemeinsamen nächtlichen bundesweiten Sendungen verantwortlich. Da du möglicherweise die entsprechenden Metadaten für deine eigene Sendung benötigst, kannst du diese anhand der folgenden IDs identifizieren. Es handelt sich hierbei um spezielle `topics`, die ausschließlich die Daten der nächtlichen Sendungen betreffen.

Intern erlaubt Eventhub diese Topics über `src/config/allowed-livestreams.json` (sie stehen nicht im ARD Core); die hinterlegte `publisherId` wird bei der Freigabe geprüft.

| Broadcast               | Publisher  | Core ID                                         |
| ----------------------- | ---------- | ----------------------------------------------- |
| ARD Hitnacht            | MDR        | `urn:ard:event-livestream:22da95c49a047225`     |
| ARD Infonacht           | NDR Info   | `urn:ard:permanent-livestream:873b8349bf7db07e` |
| ARD Musikclub           | SWR1       | `urn:ard:permanent-livestream:7c0dd5c9f90b67ab` |
| ARD Popnacht            | SWR3       | `urn:ard:permanent-livestream:885aa9c84e5374bd` |
| Die Junge Nacht der ARD | WDR/ 1LIVE | `urn:ard:permanent-livestream:d22e908de85bfd44` |

## Firehose/ Wildcard

Eventhub v3 hat keine allgemeinen Firehose-Topics mehr. Dieselbe Reichweite hat ein MQTT-Wildcard-Filter. `radio/#` ist alles Validierte. `radio/+/track/playing` ist Now-Playing jedes Livestreams, `radio/+/track/next` der nächste Titel. Die Menge bleibt groß und größtenteils irrelevant; ein Filter auf einen einzelnen Livestream bleibt die engere Wahl. Filter und Wildcards stehen unter [_MQTT Topics_](./topics).
