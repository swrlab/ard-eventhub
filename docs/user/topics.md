---
title: 'Topics'
description: 'MQTT-Topic-Baum, Publish- und Subscribe-Ziele und die Übersetzung nach NATS.'
sidebar:
  order: 3
---

Publisher schreiben nur nach `inbox/{institutionId}` und lesen nur `feedback/{institutionId}`. Alles unter `radio/` schreiben ausschließlich die Validierung, nachdem das Event angenommen wurde. Subscriber lesen `radio/`. Die Verbindung steht unter [_Migration auf MQTT_](./connect-migration), die Rechte unter [_Zugangsdaten_](./acl).

`{institutionId}` ist die Institutions-URN, zum Beispiel `urn:ard:institution:a3004ff924ece1a2`. `{livestreamId}` ist die Livestream-URN, zum Beispiel `urn:ard:permanent-livestream:49267f7d67be180d`. Es gibt keine Kurznamen wie `inbox/swr`: die URN ist dasselbe `urn:ard:…`, das in `services[].id` schon vorkommt.

## Baum

| Zweck                              | MQTT (Wire)                          | NATS (intern)                        |
| ---------------------------------- | ------------------------------------ | ------------------------------------ |
| Roh-Ingest, eine Inbox pro Anstalt | `inbox/{institutionId}`              | `inbox.{institutionId}`              |
| Ablehnung an den Publisher         | `feedback/{institutionId}`           | `feedback.{institutionId}`           |
| angenommener Now-Playing           | `radio/{livestreamId}/track/playing` | `radio.{livestreamId}.track.playing` |
| angenommener nächster Titel        | `radio/{livestreamId}/track/next`    | `radio.{livestreamId}.track.next`    |
| Steuerbits (TA, Regio, …)          | `radio/{livestreamId}/control`       | `radio.{livestreamId}.control`       |
| Radiotext, Dynamic Label, RT+      | `radio/{livestreamId}/data`          | `radio.{livestreamId}.data`          |

`plugin.{target}.{livestreamId}.{class}` ist die interne Warteschlange der Plugin-Adapter. Kein MQTT-Benutzer darf sie lesen oder schreiben.

Der Livestream steht vor der Event-Klasse, auf fester Tiefe. Damit trifft `radio/{livestreamId}/#` Control, Data und beide Track-Klassen. Läge die URN hinten, würde ein Ein-Ebenen-Filter `track/playing` verfehlen, weil das Subject dann vier Token hat.

Publish auf die Inbox geht mit QoS 1 und **ohne** Retain. Retain auf `radio/` und `feedback/` setzt die Validierung. Ein Retain vom Publisher auf der Inbox bleibt dort liegen und ist nicht der Titel, den Subscriber sehen.

## Wohin publizieren, worauf hören

| Absicht                               | MQTT-Filter                                                         |
| ------------------------------------- | ------------------------------------------------------------------- |
| eine Anstalt, alles Roh               | `inbox/urn:ard:institution:a3004ff924ece1a2`                        |
| Ablehnungen dieser Anstalt            | `feedback/urn:ard:institution:a3004ff924ece1a2`                     |
| alles Validierte                      | `radio/#`                                                           |
| ein Livestream, alle Klassen          | `radio/urn:ard:permanent-livestream:49267f7d67be180d/#`             |
| eine Klasse, alle Livestreams         | `radio/+/track/playing`                                             |
| ein Livestream, eine Klasse           | `radio/urn:ard:permanent-livestream:49267f7d67be180d/track/playing` |
| beide Track-Klassen eines Livestreams | `radio/urn:ard:permanent-livestream:49267f7d67be180d/track/+`       |

Track, Control und Data teilen sich die Inbox. Nach der Validierung wird aus `event` das `radio/`-Topic: `de.ard.eventhub.v1.radio.track.playing` liegt auf `…/track/playing`. Die Livestream-URN in dem Topic ist `services[].id`.

## MQTT nach NATS

Das Gateway schreibt Topics um. Ein Connect, der klappt und dann nichts liefert, hat meist das falsche Trennzeichen.

| MQTT | NATS | Folge                                          |
| ---- | ---- | ---------------------------------------------- |
| `/`  | `.`  | Ebenentrenner                                  |
| `.`  | `//` | ein Punkt wird zwei Zeichen in **einem** Token |
| `+`  | `*`  | eine Ebene                                     |
| `#`  | `>`  | Rest des Baums                                 |
| `:`  | `:`  | URNs bleiben ein Token                         |

Clients sprechen `/`, `+` und `#`. Ein Publish auf `inbox.urn:ard:institution:…` (Punkte) landet auf dem Subject `inbox//urn:…`, einem Token, das niemand abonniert. Richtig ist `inbox/urn:ard:institution:…`. ACLs stehen in NATS-Schreibweise (`inbox.urn:…`); auf der Leitung ist der Schrägstrich.

Leerzeichen, Tab und Zeilenumbruch im Topic werden abgewiesen.

## Subscriber, die von Pub/Sub kommen

Pub/Sub-Topics encodieren die URN (`urn%3Aard%3Apermanent-livestream%3A…`). MQTT und NATS nehmen den Doppelpunkt roh. Das Encoding entfällt, und damit das Paar aus `pubsubBuildId` und `convert-id`. Ein Filter auf den alten Topic-Namen empfängt nichts. Die erste Nachricht auf einem `radio/`-Filter nach dem Connect ist der Retain, also der letzte angenommene Stand, und gilt als Zustand, nicht als frisches Event.
