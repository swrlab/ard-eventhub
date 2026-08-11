---
title: 'Migration auf Eventhub v3'
description: 'Breaking Changes und Anpassungen für Publisher und Subscriber bei Eventhub 3.0.'
sidebar:
  order: 0
---

Diese Seite fasst die **Breaking Changes** der Eventhub-Version **3.0** (aktuell in Vorbereitung als Pre-Release `3.0.0-beta.x`) zusammen.

Geplante neue Features und die weitere Roadmap für v3 sind in der Discussion [Eventhub v3 — Plan](https://github.com/swrlab/ard-eventhub/discussions/772) beschrieben.

Die vollständige Historie findest du im [Changelog](https://github.com/swrlab/ard-eventhub/blob/main/CHANGELOG.md). Details zu Event-Feldern stehen unter [Event-Types](./event-types) und [Track-Types](./track-types).

## Überblick

- Mit `3.0.0-beta.1` (auf `test` ab `2026-08-11`)
  - 🛑 **Event-Typ Radiotext entfernt** — betrifft Publisher, die `…radio.text` gesendet haben
  - 🛑 **Response-Header `x-ard-eventhub-uid` entfernt** — betrifft Clients, die diesen Header ausgewertet haben
  - 🛑 **Feld `trace` deprecated und `null`** — in manchen Responses war das Feld enthalten, nun ist es immer `null` und wird bald entfernt
  - ⏳ **Feld `length` Pflicht und positiv** — betrifft alle Publisher von Track-Events

## Radiotext-Event entfernt

_Ab Version `3.0.0-beta.1` und aufwärts._

Der Event-Typ **`de.ard.eventhub.v1.radio.text`** (Radiotext / Live-Encoder-Text) wird in dieser Form **nicht mehr unterstützt**.

- Requests an den früheren Endpoint für Radiotext schlagen fehl bzw. sind nicht mehr in der OpenAPI spezifiziert.
- Nutze weiterhin die Track-Events `de.ard.eventhub.v1.radio.track.playing` und `de.ard.eventhub.v1.radio.track.next`.

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

## Weitere API-Hinweise (v3)

Diese Punkte sind eng mit der v3-Umstellung verbunden und sollten geprüft werden:

- **`trace` in JSON-Antworten:** Immer `null`, als **deprecated** markiert und kann in einer späteren Version entfallen. Nicht mehr auswerten.
- **Fehlende Authentifizierung (401):** Antwort entspricht nun dem dokumentierten JSON-Schema (`message`, `errors`, `trace`) — kein leerer Body mehr.
- **Publisher-Validierung:** Strengere Prüfung der erlaubten Publisher / Livestreams; unzulässige Services werden blockiert (siehe Status `blocked` in der Event-Antwort).
