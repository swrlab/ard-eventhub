---
title: 'Migration auf MQTT'
description: 'Publisher-Umstellung von HTTPS auf Eventhub Connect: Verbindung, Client-Pflichten, Beispiel.'
sidebar:
  order: 2
---

Eventhub Connect nimmt Events über **MQTT 3.1.1** an. Der HTTPS-Ingest (`POST /events/…`) bleibt nur so lange, bis der letzte Publisher umgezogen ist, und wird danach abgeschaltet. Neue Klassen (`radio.control`, `radio.data`) lehnt er mit HTTP 400 ab. Wer auf HTTPS bleibt, liefert nur die bisherigen Track-Events, und auch die nur für die Dauer der Route.

Zugangsdaten, die drei Knotennamen und das Passwort kommen vom Eventhub-Team. Topics stehen unter [_Topics_](./topics), Rechte unter [_Zugangsdaten_](./acl). Breaking Changes der HTTPS-API stehen unter [_Migration auf Eventhub v3_](./migration-v3).

## Verbindung

- **Protokoll MQTT 3.1.1.** Ein Client, der Version 5 anbietet, bekommt CONNACK-Code 1 (_unacceptable protocol version_) und kommt nie online. In mqtt.js ist 3.1.1 der Wert `protocolVersion: 4`. Bibliotheken, die still auf v5 stehen, muss man explizit umstellen.
- **TLS, Port `8883`.** Klartext `1883` gibt es nur am lokalen Broker, im CN ist er nicht offen.
- **Drei Namen, alle drei im Client:** `connect-bad`, `connect-stg`, `connect-mnz`. Jeder Name ist eine Zone. Sie lösen im DNS der Stage auf; ein Resolver außerhalb dieses DNS braucht den vollständigen Namen aus den Zugangsdaten. Test und Produktion haben getrenntes DNS: derselbe Name zeigt in `test` auf andere Rechner als in `prod`. Die Stage steht bei den Zugangsdaten.
- **Benutzername und Passwort** ersetzen den Firebase-Token. Der Name hat die Form `pub-{label}-{datum}`, zum Beispiel `pub-swr-2026-06-26`. Das Datum gehört zum Namen. Das Passwort läuft nicht ab und steht nicht in dieser Doku.
- **Zertifikatsprüfung bleibt an.** Das Zertifikat deckt alle drei Namen. Wenn der Trust-Store die CA nicht kennt, liegt das CA-PEM bei den Zugangsdaten. Prüfung abzuschalten nimmt jeden Host an, der das Passwort kennt.

## Was der Client einhalten muss

Jede dieser fünf Stellen hat schon Publisher still verlieren lassen. Die Folge steht jeweils dabei.

**Stabile Client-ID.** Die Session hängt an der Client-ID, innerhalb des Accounts, unabhängig vom Benutzernamen. Eine neue ID bei jedem Start verwirft die persistente Session: QoS-1-Nachrichten, die während eines Abbruchs in der Warteschlange lagen, sind weg. Dieselbe ID über Neustart und Passwort-Wechsel behält die Session, deshalb ist die Rotation ohne Schnitt. Zwei Prozesse mit derselben ID werfen sich gegenseitig aus der Session, die Zustellung springt zwischen ihnen. Eine ID pro Verbindung, fest vergeben, zum Beispiel `swr3-playout`.

**Alle drei DNS-Namen.** Ein Client mit nur `connect-bad` hat keinen Failover. Fällt diese Zone aus, publiziert er nichts, obwohl die anderen beiden Quorum halten und Events annehmen würden. Die Liste gehört in die Client-Konfiguration, mit Reconnect, Keep-Alive 30–60 Sekunden.

**Idempotenter Empfang.** QoS 1 ist at-least-once. Ein Reconnect liefert dieselbe Nachricht ein zweites Mal. Wer jedes Paket als neues Event zählt, doppelt Titel oder Steuerbits. Dedupe über `playlistItemId` (Track) bzw. `name` plus `start` (Control). Ein erfolgreicher Publish schreibt nichts auf `feedback/`. Stille nach dem eigenen `playlistItemId` heißt angenommen. Ein zweites Publish aus dem Reconnect-Handler ist ein zweites Event.

**Letzter `start` gewinnt.** Bei mehr als einem Validator ist die Ankunftsreihenfolge pro Livestream offen. Ein `track.next`, das ein `track.playing` überholt, setzt den falschen Titel, wenn der Subscriber nach Ankunft sortiert. Es gilt der Zeitstempel im Event: das Feld `start`, für Track, Control und Data. Ein Event mit älterem `start` als dem, das du schon hast, verwirfst du. Eine schiefe Publisher-Uhr lässt aktuelle Events als veraltet fallen oder lässt ein TA-Bit zu früh auslaufen.

**URN-only `services[]`.** Der MQTT-Pfad rechnet keine IDs um. `id`, `publisherId` und `institutionId` sind `urn:ard:…` und Pflicht. Eine CRID (`externalId`) oder eine numerische Core-ID (`publisherId: "282310"`) endet als Schema-Ablehnung auf `feedback/`, das Event erreicht `radio/` nie. `services[].externalId` und `services[].type` weglassen: sie sind deprecated und werden ignoriert, die Ablehnung nennt sie in `deprecated`. Das `externalId` auf Event-Ebene (eure eigene Track-ID) und das Event-`type` (`music`, `news`, …) bleiben. Wer die Livestream-URNs nicht hat, liest sie vor dem Umzug aus `services[].topic.id` der heutigen HTTPS-Antwort. `institutionId` muss zur Inbox und zum Livestream passen.

| Feld in `services[]` | HTTPS heute                           | MQTT                                                                        |
| -------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| `id`                 | optional, Eventhub erzeugt sie        | Pflicht, `urn:ard:permanent-livestream:…` oder `urn:ard:event-livestream:…` |
| `publisherId`        | Core-ID oder URN, Eventhub wandelt um | Pflicht, `urn:ard:publisher:…`                                              |
| `institutionId`      | entfällt, Ingest setzt sie            | Pflicht, `urn:ard:institution:…`                                            |
| `externalId`         | Pflicht, `crid://…`                   | weglassen                                                                   |
| `type`               | Pflicht, wählt das URN-Präfix         | weglassen                                                                   |

**`creator` und `created`.** `creator` ist Pflicht und nennt, wer das Event erzeugt hat, etwa eine Team-Mailadresse oder das Playout-System. Über HTTPS setzt der Ingest es aus dem Token, auf MQTT schreibt es der Publisher. Fehlt es, endet das Event als Schema-Ablehnung. `created` setzt die Validierung auf den Zeitpunkt der Zustellung; ein mitgeschickter Wert wird überschrieben.

Ein Publisher, der diese URNs schon schickt, ergänzt `creator` und ändert Verbindung und Zugangsdaten.

## Beispiel

Ersetze Benutzername, die drei URNs und das Passwort mit den Werten aus den Zugangsdaten. Die URNs unten sind das SWR-Beispiel aus den übrigen Docs; eine fremde Inbox lehnt der Broker ab, ein fremder Livestream die Validierung.

```js
import mqtt from 'mqtt'

const institutionId = 'urn:ard:institution:a3004ff924ece1a2'
const livestreamId = 'urn:ard:permanent-livestream:49267f7d67be180d'
const publisherId = 'urn:ard:publisher:75dbb3dace15f610'

const feedbackTopic = `feedback/${institutionId}`
const inboxTopic = `inbox/${institutionId}`

const client = mqtt.connect({
	protocolVersion: 4, // MQTT 3.1.1. 5 wird mit CONNACK 1 abgelehnt.
	username: 'pub-swr-2026-06-26',
	password: process.env.EVENTHUB_MQTT_PASSWORD,
	clientId: 'swr3-playout',
	clean: false, // Clean Session false: QoS 1 überlebt den Reconnect.
	keepalive: 45,
	reconnectPeriod: 5000,
	servers: [
		{ protocol: 'mqtts', host: 'connect-bad', port: 8883 },
		{ protocol: 'mqtts', host: 'connect-stg', port: 8883 },
		{ protocol: 'mqtts', host: 'connect-mnz', port: 8883 },
	],
})

const event = {
	event: 'de.ard.eventhub.v1.radio.track.playing',
	type: 'music',
	start: '2026-10-08T12:00:00+02:00',
	length: 180,
	title: 'Song name',
	playlistItemId: 'swr3-demo-1',
	services: [{ id: livestreamId, publisherId, institutionId }],
	creator: 'example@swr.de',
}

let sent = false

client.on('connect', () => {
	client.subscribe(feedbackTopic, { qos: 1 })
	if (sent) return
	sent = true
	client.publish(inboxTopic, JSON.stringify(event), { qos: 1, retain: false })
})

client.on('message', (topic, payload, packet) => {
	if (topic !== feedbackTopic) return
	const body = JSON.parse(payload.toString())
	const label = packet.retain ? 'letzte Ablehnung (retained)' : 'Ablehnung'
	console.log(label, body)
})
```

`radio.control` und `radio.data` gehen auf **dieselbe** Inbox. Die Klasse steht im Feld `event`, der Livestream in `services[].id`. Payloads stehen unter [_Event-Types_](./event-types). Publish auf `radio/…` ist dem Publisher verboten; die validierte Fassung schreibt nur die Validierung, mit Retain.

Zum Gegenprüfen brauchst du eine `sub-`-Kennung und abonnierst `radio/${livestreamId}/track/playing` (QoS 1, Clean Session false). Die erste Nachricht nach dem Connect ist der letzte Retain und gilt als aktueller Titel.

## Feedback

`feedback/{institutionId}` ist die Diagnose, kein Transaktions-ACK. Darauf zu warten blockiert den Publisher, und ein erfolgreiches Event schreibt dort nichts hin. Die Nachricht bleibt pro Institution retained: direkt nach dem Connect kommt die **letzte** Ablehnung, auch wenn sie Stunden alt ist. Zuordnen über `playlistItemId` (Track) oder über `start` plus Ziel-Subject (Control und Data). Eine neue Ablehnung ersetzt den Retain, ein Erfolg löscht ihn nicht.

Eine CRID plus numerische Core-ID, so wie der HTTPS-Body sie heute schickt, kommt so zurück:

```json
{
	"created": "2026-10-08T10:00:01.000Z",
	"institutionId": "urn:ard:institution:a3004ff924ece1a2",
	"subject": "inbox.urn:ard:institution:a3004ff924ece1a2",
	"errors": [
		{
			"path": ".body.services.0.id",
			"message": "should have required property 'id'",
			"errorCode": "required.openapi.validation"
		},
		{
			"path": ".body.services.0.publisherId",
			"message": "should match format \"regex\"",
			"errorCode": "format.openapi.validation"
		},
		{
			"path": ".body.services.0.institutionId",
			"message": "should have required property 'institutionId'",
			"errorCode": "required.openapi.validation"
		}
	],
	"playlistItemId": "swr3-demo-1",
	"start": "2026-10-08T12:00:00+02:00",
	"deprecated": ["services.externalId", "services.type"],
	"event": {
		"event": "de.ard.eventhub.v1.radio.track.playing",
		"type": "music",
		"start": "2026-10-08T12:00:00+02:00",
		"length": 180,
		"title": "Song name",
		"playlistItemId": "swr3-demo-1",
		"services": [{ "type": "PermanentLivestream", "externalId": "crid://swr.de/282310", "publisherId": "282310" }],
		"creator": "example@swr.de"
	}
}
```

`event` ist das abgelehnte Event, so wie es ankam: JSON, sonst als Text. Über 64 KiB steht dort nur der Anfang (`truncated`, `bytes`, `head`).

`created` ist der Zeitpunkt der Ablehnung. `errors` hat dieselbe Form wie `errors` in der 400-Antwort der HTTPS-API: `path`, `message`, `errorCode`, ein Eintrag pro Problem. Schema-Fehler tragen die bekannten `*.openapi.validation`-Codes. Passt ein Service nicht zur Inbox oder zum ARD-Feed, steht der Fehler am betroffenen Feld:

- `.body.services.N.id`, `User unauthorized for service` (`unauthorized.eventhub.validation`): der Livestream gehört laut Feed nicht der Anstalt dieser Inbox.
- `.body.services.N.id`, `Livestream not found > …` (`notFound.eventhub.validation`): der Livestream steht nicht im Feed.
- `.body.services.N.institutionId`, `should match the inbox institution`: `institutionId` nennt eine andere Anstalt als die Inbox.
- `.body.services.N.publisherId`, `should match the publisher of the livestream`: der Feed führt einen anderen Publisher für den Livestream.

Ist der Body kein UTF-8 oder kein JSON, steht ein einzelner Fehler auf `.body`. Maßgeblich bleiben Operator-UI und Cluster-Logs.

Eine Kennung für mehrere Anstalten publiziert jedes Event auf die Inbox der Anstalt, der der Livestream gehört. Der Broker nimmt jede erlaubte Inbox an; die falsche Inbox fällt erst in der Validierung auf.
