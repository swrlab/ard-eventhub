---
title: 'Event-Types'
description: 'Unterstützte Optionen im ARD Eventhub.'
---

Der HTTPS-Ingest (`POST /events/{eventName}`) akzeptiert derzeit diese Track-Events (Änderungen möglich):

## `de.ard.eventhub.v1.radio.track.playing`

Dieses Ereignis markiert den Beginn eines neuen Elementes/ Tracks für den jeweiligen Radiosender. Es sollte die `start` Zeitangabe der Quellinformation enthalten, um eine möglichst genaue Startzeit anzugeben und Abweichungen aufgrund von Netzwerklatenzen zu vermeiden.

`length` muss mit der geschätzten Dauer des Elements in Sekunden gesetzt werden und darf weder `0` noch `null` sein. Das Ende des aktuellen Elements ergibt sich aus dem `start` des folgenden Elements — nicht aus `start + length`.

## `de.ard.eventhub.v1.radio.track.next`

Das `next` Event hat Ähnlichkeiten zum `playing`Event aber kennzeichnet lediglich nur den planmäßig nächsten Titel. Das `next` Element kann durch ein neues `next` Element vor einem `playing` Element ersetzt werden, um einen neuen geplanten Titel zu kennzeichnen.

Ein Paar aus `next` und `playing` Events sollte eine Referenz zueinander haben (`playlistId`), damit Abonnenten diese beiden eingehenden Events miteinander verknüpfen können.

## Eventhub Connect (MQTT only)

Die folgenden Event-Klassen sind für **Eventhub Connect** vorgesehen und werden **nicht** über `POST /events/{eventName}` angenommen. Ein Request mit diesen Namen antwortet mit HTTP 400. Sie gelten erst auf dem künftigen MQTT-Pfad, mit URN-only `services[]` (`id`, `publisherId` und `institutionId` als `urn:ard:…`). Beide Klassen nutzen `start` (ISO8601), nicht `time`.

Die vollständige Spezifikation steht im [Eventhub v3 Connect RFC](https://swrlab.github.io/ard-eventhub/context-rfc/eventhub-v3-connect#13-new-event-schemas). MQTT-Kanäle werden in der [Events-Referenz](/events) (AsyncAPI) dargestellt.

## `de.ard.eventhub.v1.radio.control`

Steuerbits (TA, TP, EON, Regio und weitere). `name` ist ein freier String und **kein** Enum — neue Steuerfunktionen brauchen keine Schema-Änderung.

```json
{
	"event": "de.ard.eventhub.v1.radio.control",
	"start": "2026-05-27T16:03:00+01:00",
	"validUntil": "2026-05-27T16:18:00+01:00",
	"name": "TA",
	"state": true,
	"services": [
		{
			"publisherId": "urn:ard:publisher:75dbb3dace15f610",
			"institutionId": "urn:ard:institution:a3004ff924ece1a2",
			"id": "urn:ard:permanent-livestream:49267f7d67be180d"
		}
	]
}
```

## `de.ard.eventhub.v1.radio.data`

Zyklischer Radiotext, Dynamic Label und RT+/DL+. `cycle` ist die Wiederholzeit der Quelle in Sekunden.

`data[].type` ist `radiotext`, `dynlabel` oder `rtdlplus`. Für `radiotext` und `dynlabel` ist `id` immer `0`. Für `rtdlplus` gilt die RT+-Allowlist: `0`–`53` und `56`–`63` sind gültig, `54` und `55` sind reserviert und werden abgelehnt. Die vollständige IEC-62106-6-Tabelle steht im [RFC §13.3](https://swrlab.github.io/ard-eventhub/context-rfc/eventhub-v3-connect#133-rt-content-types).

```json
{
	"event": "de.ard.eventhub.v1.radio.data",
	"start": "2020-01-19T06:00:00+01:00",
	"cycle": 8,
	"data": [
		{ "type": "radiotext", "id": 0, "value": "Sie hören die ARD Popnacht" },
		{ "type": "dynlabel", "id": 0, "value": "Sie hören die ARD Popnacht" },
		{ "type": "rtdlplus", "id": 32, "description": "PROGRAM.Stationname long", "value": "SWR 3" }
	],
	"services": [
		{
			"publisherId": "urn:ard:publisher:75dbb3dace15f610",
			"institutionId": "urn:ard:institution:a3004ff924ece1a2",
			"id": "urn:ard:permanent-livestream:49267f7d67be180d"
		}
	]
}
```
