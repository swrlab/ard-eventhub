---
title: 'MQTT Topics'
description: 'MQTT-Topic-Baum, Publish- und Subscribe-Ziele, Wildcard-Filter und die Übersetzung nach NATS.'
sidebar:
  order: 4
  icon: list-tree
---

Publisher schreiben nur nach `inbox/{institutionId}` und lesen nur `feedback/{institutionId}`. Alles unter `radio/` schreiben ausschließlich die Eventhub Validierung, nachdem das Event angenommen wurde. Subscriber lesen `radio/`. Die Verbindung steht unter [_Eventhub Connect_](./connect-mqtt), die Rechte unter [_Zugangsdaten_](./acl).

`{institutionId}` ist die Institutions-URN, zum Beispiel `urn:ard:institution:a3004ff924ece1a2`. `{livestreamId}` ist die Livestream-URN, zum Beispiel `urn:ard:permanent-livestream:49267f7d67be180d`. Es gibt keine Kurznamen wie `inbox/swr`: die URN ist dasselbe `urn:ard:…`, das in `services[].id` schon vorkommt.

## Topic-Tree

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

Publish auf die Inbox geht mit QoS 1 und **ohne** Retain. Retain auf `radio/` und `feedback/` setzt die Eventhub Validierung. Ein Retain vom Publisher auf der Inbox bleibt dort liegen und ist nicht der Titel, den Subscriber sehen.

## Wohin publizieren, worauf hören

| Absicht                               | MQTT-Filter                                                         |
| ------------------------------------- | ------------------------------------------------------------------- |
| Ablehnungen einer Anstalt             | `feedback/urn:ard:institution:a3004ff924ece1a2`                     |
| alles Validierte                      | `radio/#`                                                           |
| ein Livestream, alle Klassen          | `radio/urn:ard:permanent-livestream:49267f7d67be180d/#`             |
| eine Klasse, alle Livestreams         | `radio/+/track/playing`                                             |
| ein Livestream, eine Klasse           | `radio/urn:ard:permanent-livestream:49267f7d67be180d/track/playing` |
| beide Track-Klassen eines Livestreams | `radio/urn:ard:permanent-livestream:49267f7d67be180d/track/+`       |

Track, Control und Data teilen sich die Inbox. Nach der Eventhub Validierung wird aus `event` das `radio/`-Topic: `de.ard.eventhub.v1.radio.track.playing` liegt auf `…/track/playing`. Die Livestream-URN in dem Topic ist `services[].id`.

## Wildcard-Filter

Ein Filter vergleicht Ebene für Ebene. `/` trennt die Ebenen. `+` und `#` ersetzen jeweils eine ganze Ebene. In `radio/urn:ard:+` ist `urn:ard:+` ein Literal, der Doppelpunkt schneidet die URN nicht.

`+` trifft genau eine Ebene und darf mehrfach stehen. `radio/+/track/playing` trifft Now-Playing jedes Livestreams: die URN enthält Doppelpunkte und bleibt eine Ebene, weil kein `/` darin vorkommt. `radio/+/track/+` trifft `playing` und `next` aller Livestreams.

`#` trifft den Rest des Baums, eine oder mehrere Ebenen, und steht als letzte Ebene. `radio/#` ist alles unter `radio/`. `radio/{livestreamId}/#` ist Control, Data und beide Track-Klassen. `radio/#/data` weist der Broker ab.

Control und Data liegen eine Ebene unter dem Livestream (`…/control`, `…/data`). Die Track-Klassen liegen zwei Ebenen darunter (`…/track/playing`, `…/track/next`). `radio/{livestreamId}/+` trifft deshalb Control und Data. `…/track/+` trifft beide Track-Klassen, `#` trifft alle vier.

`*` und `>` gelten auf der Leitung als Literale. Ein Punkt gehört zum Ebenennamen: `radio/+/track.playing` sucht die Ebene `track.playing` und verfehlt `…/track/playing`.

Publish-Ziele tragen keine Wildcards. Die Inbox ist exakt `inbox/{institutionId}`.

## Subscriber, die von Pub/Sub kommen

Pub/Sub-Topics encodieren die URN (`urn%3Aard%3Apermanent-livestream%3A…`). MQTT und NATS nehmen den Doppelpunkt roh. Das Encoding entfällt.

## Für Devs: MQTT nach NATS

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
