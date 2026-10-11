---
title: 'Zugangsdaten'
description: 'MQTT-Benutzernamen, Rotation und was eine Kennung publizieren und abonnieren darf.'
sidebar:
  order: 4
---

Eventhub Connect authentifiziert mit Benutzername und Passwort über TLS. Es gibt keinen Token-Refresh. Der HTTPS-Login unter [_Authentifizierung_](./authentication) gilt für `POST /events` und läuft mit dem HTTPS-Ingest aus. Verbindung und Client-Pflichten stehen unter [_Migration auf MQTT_](./connect-migration), die Topics unter [_Topics_](./topics).

Die Kennung beantragst du beim Eventhub-Team. Du bekommst den Benutzernamen, das Passwort, die Institutions-URN oder URNs, für die sie gilt, und die Stage (`test` oder `prod`). Das Passwort steht nur bei euch und in der verschlüsselten Betriebs-Config, nicht in Git und nicht in dieser Doku.

## Namen

| Klasse         | Form                   | Beispiel                          |
| -------------- | ---------------------- | --------------------------------- |
| Publisher      | `pub-{label}-{datum}`  | `pub-swr-2026-06-26`              |
| Subscriber     | `sub-{rolle}-{datum}`  | `sub-ard-sounds-2026-06-26`       |
| Dienst, MQTT   | `svc-ingest`           | Legacy-HTTPS, schreibt jede Inbox |
| Dienst, intern | `svc-eventhub-connect` | NATS, keine Publisher-Kennung     |

Das Präfix `pub-` ist reserviert: damit darf man nur in die eigenen Inboxes publizieren und das passende `feedback/` lesen. `sub-` ist Konvention. `svc-` ist für Prozesse von Eventhub, nicht für Häuser.

Der Namensbestandteil `swr` wird nirgends gelesen. Die ACL bindet den Benutzer an Subjects `inbox.urn:ard:institution:…`, und die Validierung nimmt die Anstalt aus dem Topic, nicht aus dem Namen. Der Name ist das Label in der Operator-UI.

## Was die Kennung darf

Ein Publisher darf:

- publizieren auf `inbox.{institutionId}` für jede URN, die in seiner ACL steht
- abonnieren auf `feedback.{institutionId}` für dieselben URNs

Ein Publisher darf nicht:

- `radio.` lesen oder schreiben, auch nicht den eigenen Livestream
- `plugin.` lesen oder schreiben
- eine Inbox publizieren, die nicht in der ACL steht (der Broker weist das vor dem Event ab)
- die HTTPS-Firebase-Kennung als MQTT-Passwort verwenden

Wer Events auch empfangen will, bekommt eine zweite Kennung mit `sub-`. Eine kompromittierte Publisher-Kennung kann damit den Eventstrom nicht mitlesen, eine kompromittierte Subscriber-Kennung kann nichts einspeisen. Subscriber publizieren nichts (`publish` deny auf `>`).

Die Prüfung am Broker gilt dem **Topic**, nicht dem JSON. Eine SWR-Kennung kann ein Payload mit einem NDR-Livestream auf die SWR-Inbox legen; die Validierung weist das ab (`User unauthorized for service` in `errors` auf `feedback/`). `services[].institutionId` muss zur Inbox und zum Livestream im ARD-Feed passen.

Mehrere Anstalten auf einer Kennung sind eine Liste von Inboxes, kein Wildcard. Jedes Event geht auf die Inbox der Anstalt, der der Livestream gehört. Der Broker nimmt jede gelistete Inbox an, die falsche Kombination fällt in der Validierung auf. Auf dem HTTPS-Ingest bleibt es bei einer Anstalt pro Firebase-Benutzer; mehrere Anstalten gibt es nur auf MQTT.

`svc-ingest` schreibt `inbox.>` für Häuser, die noch per HTTPS liefern. Das ist derselbe Topic wie bei einem nativen Publisher. Eine Haus-Kennung bekommt dieses Wildcard nicht.

## Rotation

Das Passwort läuft nicht von selbst ab. Ein geleaktes Passwort gilt, bis es rotiert wird. TLS ist Pflicht, der Schaden einer einzelnen Kennung ist eine Inbox oder ein Lese-Scope, und das Entziehen ist ein Config-Reload.

Die Rotation ist additiv, weil der Name das Ausstellungsdatum trägt:

1. `pub-swr-2027-01-15` kommt neben `pub-swr-2026-06-26`, gleiche Rechte, neues Passwort.
2. Config-Reload. Beide Kennungen gelten.
3. Das Haus stellt den Client um, wann es passt. Dieselbe Client-ID behält die Session, inklusive wartender QoS-1-Nachrichten. Topics bleiben, das Datum steht in keinem Topic.
4. Wenn die Operator-UI keine Verbindung mehr auf dem alten Namen zeigt, wird der alte User entfernt und noch einmal geladen.

Ein entzogener User verliert die Verbindung beim Reload. Der nächste Connect scheitert an der Anmeldung.
