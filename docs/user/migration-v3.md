---
title: 'Migration auf Eventhub v3'
description: 'Breaking Changes und Anpassungen für Publisher und Subscriber bei Eventhub 3.0.'
sidebar:
  order: 0
---

Diese Seite fasst die **Breaking Changes** der HTTPS-API in Eventhub **3.0** (aktuell Pre-Release `3.0.0-beta.x`) zusammen. Der Zielweg für Publisher ist MQTT; der HTTPS-Ingest bleibt nur bis zum letzten Umzug und wird dann abgeschaltet. Anbindung, Topics und Rechte: [_Migration auf MQTT_](./connect-migration), [_Topics_](./topics), [_Zugangsdaten_](./acl).

Geplante neue Features und die weitere Roadmap für v3 sind in der Discussion [Eventhub v3 — Plan](https://github.com/swrlab/ard-eventhub/discussions/771) beschrieben.

Die vollständige Historie findest du im [Changelog](https://github.com/swrlab/ard-eventhub/blob/main/CHANGELOG.md).

## Überblick

- Mit `3.0.0-beta.1` (auf `test` ab `2026-08-11`)
  - 🛑 **Event-Typ Radiotext entfernt** — betrifft Publisher, die `…radio.text` gesendet haben
  - 🛑 **Response-Header `x-ard-eventhub-uid` entfernt** — betrifft Clients, die diesen Header ausgewertet haben
  - 🛑 **Feld `trace` deprecated und `null`** — in manchen Responses war das Feld enthalten, nun ist es immer `null` und wird bald entfernt
  - ⏳ **Feld `length` Pflicht und positiv** — betrifft alle Publisher von Track-Events
- Im aktuellen Pre-Release (nach `3.0.0-beta.1`)
  - 🛑 **Temporäres Publisher-Mapping entfernt** — betrifft rbb und hr, die noch eine der alten Publisher-URNs senden

## Radiotext-Event entfernt

_Ab Version `3.0.0-beta.1` und aufwärts._

Der Event-Typ **`de.ard.eventhub.v1.radio.text`** (Radiotext / Live-Encoder-Text) wird in dieser Form **nicht mehr unterstützt**.

- Requests an den früheren Endpoint für Radiotext schlagen fehl bzw. sind nicht mehr in der OpenAPI spezifiziert.
- Nutze weiterhin die Track-Events `de.ard.eventhub.v1.radio.track.playing` und `de.ard.eventhub.v1.radio.track.next`.
- Der Nachfolger ist `de.ard.eventhub.v1.radio.data` (Radiotext, Dynamic Label, RT+). Dieser Typ ist **nur für Eventhub Connect / MQTT** vorgesehen und wird auf dem heutigen HTTPS-Ingest (`POST /events/…`) mit HTTP 400 abgelehnt. Siehe _Event-Types_.

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

## Weitere API-Hinweise (v3)

Diese Punkte sind eng mit der v3-Umstellung verbunden und sollten geprüft werden:

- **`trace` in JSON-Antworten:** Immer `null`, als **deprecated** markiert und kann in einer späteren Version entfallen. Nicht mehr auswerten.
- **Fehlende Authentifizierung (401):** Antwort entspricht nun dem dokumentierten JSON-Schema (`message`, `errors`, `trace`) — kein leerer Body mehr.
- **Publisher-Validierung:** Strengere Prüfung der erlaubten Publisher / Livestreams; unzulässige Services werden blockiert (siehe Status `blocked` in der Event-Antwort).
