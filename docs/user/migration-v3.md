---
title: 'Migration auf Eventhub v3'
description: 'Breaking Changes der HTTPS-API und der MQTT-Umstellung für Publisher und Subscriber bei Eventhub 3.0.'
sidebar:
  order: 0
  icon: wrench
---

Diese Seite fasst die **Breaking Changes** von Eventhub **3.0** zusammen (aktuell Pre-Release `3.0.0-beta.x`): die HTTPS-API und die Umstellung auf Eventhub Connect über MQTT. Der HTTPS-Ingest bleibt nur bis zum letzten Umzug und wird dann abgeschaltet.

- Anbindung und Beispiel: [_Eventhub Connect_](./connect-mqtt)
- Topics und Filter: [_Topics_](./topics)
- Benutzer, Passwort, Rechte: [_Zugangsdaten_](./acl)
- Payloads: [_radio.track.playing_](../event/radio.track.playing), [_radio.track.next_](../event/radio.track.next), [_radio.control_](../event/radio.control), [_radio.data_](../event/radio.data)

Diese neuen Features für v3 wurden ursprünglich in der GitHub Discussion [Eventhub v3 — Plan](https://github.com/swrlab/ard-eventhub/discussions/771) besprochen.

Die vollständige Historie aller Changes findest du im [Changelog](https://github.com/swrlab/ard-eventhub/blob/main/CHANGELOG.md).

## Überblick

- Mit `3.0.0-beta.1` (auf `test` ab `2026-08-11`, auf `prod` ab `2026-10-21`)
  - 🛑 **Event-Typ Radiotext entfernt** — betrifft Publisher, die `…radio.text` gesendet haben
  - 🛑 **Response-Header `x-ard-eventhub-uid` entfernt** — betrifft Clients, die diesen Header ausgewertet haben
  - 🛑 **Feld `trace` deprecated und `null`** — in manchen Responses war das Feld enthalten, nun ist es immer `null` und wird bald entfernt
  - ⏳ **Feld `length` Pflicht und positiv** — betrifft alle Publisher von Track-Events
- Im aktuellen Pre-Release (nach `3.0.0-beta.1`)
  - 🛑 **Temporäres Publisher-Mapping entfernt** — betrifft rbb und hr, die noch eine der alten Publisher-URNs senden
  - 🛑 **MQTT nimmt in `services[]` nur URNs** — Core-ID und CRID werden abgelehnt
  - 🛑 **`creator` Pflicht, `created` wird überschrieben** — betrifft jeden Connect-Publisher
  - 🛑 **Topics ohne Percent-Encoding** — Subscriber, die Topic-Namen aus Pub/Sub übernehmen
  - 🛑 **Feedback-Body umgestellt** — `errors[]` und `created` ersetzen die früheren Felder
  - **Feld `media[].templateUrl` deprecated** — eine konkrete `url` schicken; ein Template mit `{width}` und `{height}` wird noch akzeptiert

## Radiotext-Event entfernt

_Ab Version `3.0.0-beta.1` und aufwärts._

Der Event-Typ **`de.ard.eventhub.v1.radio.text`** (Radiotext / Live-Encoder-Text) wird in dieser Form **nicht mehr unterstützt**.

- Requests an den früheren Endpoint für Radiotext schlagen fehl bzw. sind nicht mehr in der OpenAPI spezifiziert.
- Nutze weiterhin die Track-Events `de.ard.eventhub.v1.radio.track.playing` und `de.ard.eventhub.v1.radio.track.next`.
- Der Nachfolger ist `de.ard.eventhub.v1.radio.data` (Radiotext, Dynamic Label, RT+). Er ist **nur für Eventhub Connect / MQTT** vorgesehen und wird auf dem heutigen HTTPS-Ingest (`POST /events/…`) mit HTTP 400 abgelehnt. Siehe [_radio.data_](../event/radio.data).
- `de.ard.eventhub.v1.radio.control` ist neu und ebenfalls nur über MQTT erreichbar. Der HTTPS-Ingest antwortet mit HTTP 400. Siehe [_radio.control_](../event/radio.control).

## Response-Header `x-ard-eventhub-uid` entfernt

_Ab Version `3.0.0-beta.1` und aufwärts._

Nach erfolgreicher Authentifizierung setzt die API den Response-Header **`x-ard-eventhub-uid` nicht mehr**.

**Aktion:** Auswertungen dieses Headers in Clients entfernen. Die Nutzeridentität weiterhin über den JWT / die Auth-Antwort (`user`) beziehen, falls erforderlich.

## Feld `length` ist Pflicht

_Ab Version `3.0.0-beta.1` und aufwärts._

Bei Track-Events (`playing` / `next`) muss **`length`** gesetzt sein:

- Wert: geschätzte Dauer des Elements in **Sekunden**
- **nicht** `0`, **nicht** `null`, Feld darf nicht fehlen
- Das **Ende** des aktuellen Elements ergibt sich aus dem **`start` des folgenden Elements** — nicht aus `start + length`

Ungültige Werte führen zu **HTTP 400**.

Beispiel:

```json
{
	"type": "music",
	"start": "2020-01-19T06:00:00+01:00",
	"length": 240,
	"title": "Song name",
	"services": [
		{
			"type": "PermanentLivestream",
			"externalId": "crid://swr.de/123450",
			"publisherId": "282310"
		}
	],
	"playlistItemId": "swr3-5678"
}
```

**Aktion:** Publisher so anpassen, dass immer eine positive Schätzlänge mitgeschickt wird.

## Temporäres Publisher-Mapping entfernt

_Im aktuellen Pre-Release, nach `3.0.0-beta.1`._

Für elf Sender von rbb und hr hat der HTTPS-Ingest eine ältere Publisher-URN still auf die URN aus dem ARD Core Feed umgebogen. Diese Zuordnung ist entfernt. `publisherId` muss die URN sein, die der Feed für den Sender führt. Eine URN aus der Spalte „Bisherige URN“ gilt als unbekannter Publisher, der Service kommt mit Status `blocked` zurück.

Eine numerische Core-ID hasht der HTTPS-Ingest weiterhin zu `urn:ard:publisher:…`. Entspricht dieser Hash einer bisherigen URN, findet der Feed den Publisher ebenfalls nicht mehr.

| Sender              | Bisherige URN                        | URN im Feed                          |
| ------------------- | ------------------------------------ | ------------------------------------ |
| inforadio           | `urn:ard:publisher:d6ea740f7417ed56` | `urn:ard:publisher:d7b84d265c36f604` |
| antenne brandenburg | `urn:ard:publisher:f3e5ab48670f74d5` | `urn:ard:publisher:1b6ae8b401a077fd` |
| fritz               | `urn:ard:publisher:b9fa15c6413e47d3` | `urn:ard:publisher:c03f427b1367429c` |
| radioeins           | `urn:ard:publisher:ef1f1e7569f8fc54` | `urn:ard:publisher:9e8b2b6352741adb` |
| rbb 88.8            | `urn:ard:publisher:5ce081233481abdc` | `urn:ard:publisher:599a095fa84a416e` |
| hr-info             | `urn:ard:publisher:186d6d95c32a3e80` | `urn:ard:publisher:91601d9841363177` |
| hr1                 | `urn:ard:publisher:9944e1d1f9ecfbc6` | `urn:ard:publisher:bb3ac9eaa762650d` |
| hr2-kultur          | `urn:ard:publisher:219807efdec52f82` | `urn:ard:publisher:d8537bdd4f74dda8` |
| hr3                 | `urn:ard:publisher:8e9d2d848d4bf08b` | `urn:ard:publisher:9aa39a36e69eeb3b` |
| hr4                 | `urn:ard:publisher:3d62b2d2d032a703` | `urn:ard:publisher:5db2b80a1ca0b08e` |
| you-fm              | `urn:ard:publisher:926798b983bc780a` | `urn:ard:publisher:1f4259e1b54a861d` |

**Aktion:** rbb und hr stellen `publisherId` auf die URN aus der Spalte „URN im Feed“ um. Auf MQTT gilt dieselbe URN: der Connect-Pfad hat diese Aliase nie umgebogen.

## `services[]` auf MQTT nur noch URNs

_Im aktuellen Pre-Release, nach `3.0.0-beta.1`._

Der HTTPS-Ingest rechnet weiter um: `publisherId` als numerische Core-ID oder URN, und `id` aus `externalId` plus `type`, wenn `id` fehlt. Eventhub Connect rechnet nicht um. Ein Event mit CRID oder Core-ID landet auf `feedback/` und erreicht `radio/` nicht.

- `id`, `publisherId` und `institutionId` sind Pflicht und haben die Form `urn:ard:…`
- `services[].externalId` und `services[].type` weglassen. Sie sind deprecated, werden ignoriert, und die Ablehnung nennt sie unter `deprecated`
- Die `externalId` auf Event-Ebene und das Event-`type` (`music`, `news`, …) bleiben

Auf HTTPS setzt der Ingest `institutionId` selbst. `externalId` und `type` in `services[]` bleiben dort befüllt. Beide sind deprecated und fallen erst weg, wenn Pub/Sub abgeschaltet wird.

**Aktion:** Vor dem Umzug die Livestream-URN aus `services[].topic.id` der heutigen HTTPS-Antwort lesen. Pflichtfelder, Beispiel und die Ablehnungen stehen in [_Eventhub Connect_](./connect-mqtt).

## `creator` und `created`

_Im aktuellen Pre-Release, nach `3.0.0-beta.1`._

Jedes Connect-Event (`track.playing`, `track.next`, `radio.control`, `radio.data`) braucht `creator`: wer das Event erzeugt hat, etwa eine Team-Mailadresse oder das Playout-System. `created` setzt die Eventhub Validierung auf den Zeitpunkt der Zustellung. Ein mitgeschickter Wert wird ersetzt.

**Aktion:** `creator` mitschicken. Einen mitgeschickten `created` nicht als eigenen Zeitstempel auswerten. Details und Beispiel: [_Eventhub Connect_](./connect-mqtt).

## Topics ohne Percent-Encoding

_Im aktuellen Pre-Release, nach `3.0.0-beta.1`._

Pub/Sub-Topics encodieren die URN (`urn%3Aard%3Apermanent-livestream%3A…`). MQTT und NATS nehmen den Doppelpunkt roh. Das Encoding entfällt, und mit ihm das Paar `pubsubBuildId` / `convert-id`.

**Aktion:** Filter und Topic-Namen auf die rohe URN umstellen. Baum, Wildcards und die Pub/Sub-Zeile: [_Topics_](./topics).

## Feedback-Body umgestellt

_Im aktuellen Pre-Release, nach `3.0.0-beta.1`._

`feedback/{institutionId}` ist die Diagnose, kein ACK. Ein angenommenes Event schreibt dort nichts. Die Nachricht bleibt pro Institution retained.

Wer den früheren Body schon gelesen hat, muss umstellen. Weg sind `cause`, `message`, `issues`, `disagreed`, `livestreamId` und `at`.

- `errors[]` mit `path`, `message` und `errorCode`, dieselbe Form wie `errors` in der HTTPS-400
- `created` statt `at`
- `event` ist das abgelehnte Event, so wie es ankam
- Zuordnen über `playlistItemId` (Track) oder über `start` plus Subject (Control und Data)

**Aktion:** Auswertungen der alten Felder entfernen. Beispiel und Fehlercodes: [_Eventhub Connect_](./connect-mqtt), Abschnitt Feedback.

## `media[].templateUrl` deprecated

_Im aktuellen Pre-Release, nach `3.0.0-beta.1`._

`templateUrl` in `media[]` ist **deprecated**. Schick eine konkrete `url`. Ein Template mit `{width}` und `{height}` wird noch akzeptiert. Beispiele stehen unter [_Bilder_](./images).

**Aktion:** `templateUrl` nicht mehr mitschicken.

## Weitere API-Hinweise (v3)

Diese Punkte sind eng mit der v3-Umstellung verbunden und sollten geprüft werden:

- **`trace` in JSON-Antworten:** Immer `null`, als **deprecated** markiert und kann in einer späteren Version entfallen. Nicht mehr auswerten.
- **Fehlende Authentifizierung (401):** Antwort entspricht nun dem dokumentierten JSON-Schema (`message`, `errors`, `trace`) — kein leerer Body mehr.
- **Publisher-Validierung:** Strengere Prüfung der erlaubten Publisher / Livestreams; unzulässige Services werden blockiert (siehe Status `blocked` in der Event-Antwort).
