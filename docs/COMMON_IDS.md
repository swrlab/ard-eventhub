# Allgemeine IDs

## Nächtliche Landesweite Sendungen

Einige Sender sind für die Bereitstellung von gemeinsamen nächtlichen landesweiten Sendungen verantwortlich. Da Sie möglicherweise die entsprechenden Metadaten für Ihre eigenen Sendungen benötigen, können Sie diese anhand der folgenden IDs identifizieren. Es handelt sich hierbei um spezielle `topics`, die ausschließlich die Daten der nächtlichen Sendungen betreffen.

| Broadcast               | Publisher  | Core ID                                         | Nightly-only topic? |
| ----------------------- | ---------- | ----------------------------------------------- | ------------------- |
| ARD Hitnacht            | MDR        | `urn:ard:event-livestream:22da95c49a047225`     | true                |
| ARD Infonacht           | NDR Info   | n/a                                             | n/a                 |
| ARD Popnacht            | SWR3       | `urn:ard:permanent-livestream:885aa9c84e5374bd` | true                |
| Die Junge Nacht der ARD | WDR/ 1LIVE | `urn:ard:permanent-livestream:d22e908de85bfd44` | true                |

## Allgemeine/ Firehose Topics

Jede Instanz des Eventhubs hat allgemeine `topics`, die für die Bereitstellung aller Ereignisse verwendet werden. Dies sind die sogenannten „firehose“-Themen.

Sie sind nach Ereignistypen unterteilt, daher können Sie entweder `v1.radio.track.playing` oder `v1.radio.track.next` abonnieren. Bitte beachten Sie, dass Sie aufgrund der hohen Anzahl von für Sie wahrscheinlich irrelevanten Ereignissen vorzugsweise ein Abonnement für das `topic` eines einzelnen Livestreams verwenden sollten.

## Andere IDs

Alle anderen IDs für Livestreams finden Sie in der API. (`GET /topics`).
