---
title: 'Eventhub Connect MQTT'
description: 'MQTT-Anbindung an Eventhub Connect: Firewall, Verbindung, Client, Payload und Feedback.'
sidebar:
  order: 2
  icon: rocket
---

Eventhub Connect nimmt Events über **MQTT 3.1.1** an. Du publizierst auf `inbox/{institutionId}` und liest Ablehnungen auf `feedback/{institutionId}`. Die validierten Events schreibt die Eventhub Validierung auf `radio/`, mit Retain und QoS 1.

Zugangsdaten, das Passwort, das Präfix für die Client-ID und das CA-Zertifikat kommen vom Eventhub-Team. Topics stehen unter [_Topics_](./topics), Rechte unter [_Zugangsdaten_](./acl). Support steht unter [_Betrieb und Support_](./betrieb). Breaking Changes beim Umstieg von der HTTPS-API stehen unter [_Migration auf Eventhub v3_](./migration-v3).

## Vor dem Start

Vor dem ersten Connect braucht jedes Haus drei Dinge:

- **Zugang ins ARD CN.** Eventhub Connect ist nur aus dem ARD CN erreichbar. Es gibt keinen Internet-Endpunkt und keinen eingehenden Port beim Haus — dein Client baut die TCP-Verbindung ausgehend auf. Den ARD-CN-Zugang und die eigene Firewall-Freigabe regelt jedes Haus über seinen eigenen Prozess.
- **Zugangsdaten vom Eventhub-Team.** Du bekommst Benutzername (`pub-…` zum Senden, `sub-…` zum Empfangen), Passwort, das Präfix für deine Client-IDs, die freigeschalteten Institutions-URNs und das CA-PEM für die TLS-Prüfung, siehe [_Zugangsdaten_](./acl).
- **Ausgehende Firewall-Freigabe im Haus.** Alle drei Stages (`dev`, `test`, `prod`) laufen auf denselben drei Maschinen unter eigenen Hostnamen. Alle drei Zonen (`bad`, `mnz`, `stg`) und alle drei Stages gehören in einen gemeinsamen Antrag — fällt eine Zone aus, übernehmen die anderen beiden.

### Firewall-Werte für Häuser

**Quelle**

Eigene Systeme im Haus (Playout, Adapter oder Subscriber) im ARD CN.

**Ziel**

- `eventhub-connect-{bad,mnz,stg}-{dev,test,prod}.swr.cn.ard.de` — alle neun FQDNs eintragen (`bad`, `mnz` und `stg`, jeweils für `dev`, `test` und `prod`)

**Ports**

- MQTT
  - TCP `28883` — `dev`
  - TCP `18883` — `test`
  - TCP `8883` — `prod`
- Operator-UI im Browser (optional)
  - TCP `443` — Operator-UI
  - TCP `29222` — NATS WebSocket, `dev`
  - TCP `19222` — NATS WebSocket, `test`
  - TCP `9222` — NATS WebSocket, `prod`

## Verbindung

- **Protokoll MQTT 3.1.1.** Ein Client, der Version 5 anbietet, bekommt CONNACK-Code 1 (_unacceptable protocol version_) und kann sich nicht verbinden. In mqtt.js ist 3.1.1 der Wert `protocolVersion: 4`. Bibliotheken, die still auf v5 stehen, muss man explizit auf 3.1.1 stellen.
- **TLS, Port je Stage:** `28883` (`dev`), `18883` (`test`), `8883` (`prod`).
- **Drei Hostnamen pro Stage, alle drei im Client:** `eventhub-connect-{bad,mnz,stg}-{dev,test,prod}.swr.cn.ard.de` — jeder Name (`bad`, `mnz`, `stg`) ist eine Zone, und Stage sowie Port gehören zusammen (`*-dev` auf `28883`, `*-test` auf `18883`, `*-prod` auf `8883`).
- **Benutzername und Passwort.** Der Name hat die Form `pub-{label}-{datum}`, zum Beispiel `pub-swr-2026-06-26`. Das Datum gehört zum Namen. Das Passwort läuft nicht ab und steht nicht in dieser Doku. Das Eventhub-Team rotiert Kennungen in unregelmäßigen Intervallen oder anlassbezogen additiv: ein neuer Nutzer plus Passwort kommen zur alten Kennung hinzu, beide gelten parallel, bis die alte entfernt wird.
- **Zertifikatsprüfung an.** Jede Stage hat ein eigenes Zertifikat über alle drei Zonen-Namen unter der `Rundfunk-Root-CA-2015`. Wenn der Trust-Store die CA nicht kennt, liegt das CA-PEM bei den Zugangsdaten.

## Client

**Stabile Client-ID.** Die Session hängt an der Client-ID, innerhalb des Accounts, unabhängig vom Benutzernamen. Eine neue ID bei jedem Start verwirft die persistente Session: QoS-1-Nachrichten, die während eines Abbruchs in der Warteschlange lagen, sind weg. Dieselbe ID über Neustart und Passwort-Wechsel behält die Session. Zwei Verbindungen mit derselben ID werfen sich gegenseitig aus der Session, auch wenn sie zu verschiedenen Benutzern gehören. Das Eventhub-Team gibt mit den Zugangsdaten ein Präfix vor. Jede Client-ID muss damit beginnen, eine pro Verbindung, fest vergeben, zum Beispiel `swr-swr3-playout`.

**Alle drei DNS-Namen.** Die Liste gehört in die Client-Konfiguration, mit Reconnect und Keep-Alive 30–60 Sekunden. Ein Client mit nur `eventhub-connect-bad-prod.swr.cn.ard.de` publiziert nichts, sobald diese Zone ausfällt, obwohl die anderen beiden Quorum halten und Events annehmen würden.

**QoS 1.** QoS 1 ist at-least-once. Ein Reconnect liefert dieselbe Nachricht ein zweites Mal. Wer jedes Paket als neues Event zählt, doppelt Titel oder Steuerbits. Deduplizierung über `playlistItemId` (Track) bzw. `name` plus `start` (Control). Ein erfolgreicher Publish schreibt nichts auf `feedback/`. Stille nach dem eigenen `playlistItemId` heißt angenommen.

## Payload

Der Payload muss gültiges JSON in UTF-8 sein. MQTT 3.1.1 hat kein Charset-Feld; die Eventhub Validierung liest die Bytes strikt als UTF-8. Anderes oder kein JSON ist ein Fehler auf `.body`.

`id`, `publisherId` und `institutionId` in `services[]` sind `urn:ard:…` und Pflicht. Eine CRID (`externalId`) oder eine numerische Core-ID (`publisherId: "282310"`) endet als Schema-Ablehnung auf `feedback/`. `services[].externalId` und `services[].type` weglassen: sie sind deprecated und werden ignoriert, die Ablehnung nennt sie in `deprecated`. Die `externalId` auf Event-Ebene (eure eigene Track-ID) und das Event-`type` (`music`, `news`, …) bleiben. `institutionId` muss zur Inbox und zum Livestream passen.

- `id`: `urn:ard:permanent-livestream:…` oder `urn:ard:event-livestream:…`
- `publisherId`: `urn:ard:publisher:…`
- `institutionId`: `urn:ard:institution:…`
- `externalId` und `type` in `services[]`: weglassen

**`creator` und `created`.** `creator` ist Pflicht und nennt, wer das Event erzeugt hat, etwa eine Team-Mailadresse oder das Playout-System. Dies kann für Rückfragen von Subscribern genutzt werden und sollte eine gültige erreichbare Adresse sein. `created` setzt die Eventhub Validierung auf den Zeitpunkt der Zustellung; ein mitgeschickter Wert wird überschrieben.

## Beispiel

Ersetze Benutzername, Client-ID-Präfix, die drei URNs und das Passwort mit den Werten aus den Zugangsdaten. Die URNs unten sind das SWR-Beispiel aus den übrigen Docs; eine fremde Inbox lehnt der Broker ab, ein fremder Livestream die Eventhub Validierung.

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
	clientId: 'swr-swr3-playout', // Präfix aus den Zugangsdaten, danach ein eigener Name.
	clean: false, // Clean Session false: QoS 1 überlebt den Reconnect.
	keepalive: 45,
	reconnectPeriod: 5000,
	// Für dev: *-dev.swr.cn.ard.de (Port 28883); für test: *-test.swr.cn.ard.de (Port 18883).
	servers: [
		{ protocol: 'mqtts', host: 'eventhub-connect-bad-prod.swr.cn.ard.de', port: 8883 },
		{ protocol: 'mqtts', host: 'eventhub-connect-mnz-prod.swr.cn.ard.de', port: 8883 },
		{ protocol: 'mqtts', host: 'eventhub-connect-stg-prod.swr.cn.ard.de', port: 8883 },
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

`radio.control` und `radio.data` gehen auf **dieselbe** Inbox. Die Klasse steht im Feld `event`, der Livestream in `services[].id`. Now und Control sind Pflicht, Next und Data optional: [_Überblick_](../event/index). Payloads stehen unter [_radio.control_](../event/radio.control) und [_radio.data_](../event/radio.data). Track-Events: [_radio.track.playing_](../event/radio.track.playing), [_radio.track.next_](../event/radio.track.next). Publish auf `radio/…` ist dem Publisher verboten; die validierte Fassung schreibt nur die Eventhub Validierung, mit Retain.

Zum Gegenprüfen/ Subscriben brauchst du eine `sub-`-Kennung und abonnierst `radio/${livestreamId}/track/playing`. Die erste Nachricht nach dem Connect ist der letzte Retain und gilt als aktueller Titel.

## Feedback

`feedback/{institutionId}` ist die Diagnose, kein Transaktions-ACK. Darauf zu warten blockiert den Publisher, und ein erfolgreiches Event schreibt dort nichts hin. Die Nachricht bleibt pro Institution retained: direkt nach dem Connect kommt die **letzte** Ablehnung, auch wenn sie Stunden alt ist. Zuordnen über `playlistItemId` (Track) oder über `start` plus Ziel-Subject (Control und Data). Felder, Fehlercodes und ein Beispiel stehen unter [_feedback_](../event/feedback). Maßgeblich bleiben Operator-UI und Cluster-Logs.

Eine Kennung für mehrere Anstalten publiziert jedes Event auf die Inbox der Anstalt, der der Livestream gehört. Der Broker nimmt jede erlaubte Inbox an; die falsche Inbox fällt erst in der Eventhub Validierung auf.
