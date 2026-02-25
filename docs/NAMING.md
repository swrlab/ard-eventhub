# ARD Eventhub / Namenskonventionen

Verschiedene Teile dieses Dienstes erfordern durchgehende (konsistente) Namenskonventionen.

## Google Cloud Pub/Sub

Pub/Sub besitzt Einschränkungen für Namen, Keys und Werte. Für alle Felder (Module, Stage, serviceId etc.) gelten unter anderem folgende Regeln:

- Keys außer `stage` dürfen keine Werte einer Staging-Umgebung enthalten (z.B. darf `service` nicht `prod` enthalten)
- Alle Werte werden klein geschrieben und enthalten keine Sonderzeichen wie `äöü`.
  - Dieser Dienst nutzt einen Slug-Converter, um Institutionennamen in verwendbare und lesbare Strings zu verwandeln
- Google-Einschränkungen für IDs:
  - Muss 3–255 Zeichen lang sein, mit einem Buchstaben beginnen und darf nur die folgenden Zeichen enthalten: Buchstaben, Zahlen, Bindestriche (-), Punkte (.), Unterstriche (_), Tilden (~), Prozentzeichen (%) oder Pluszeichen (+). Darf nicht mit `goog` beginnen.

## Pub/Sub Topics

```txt
<domain-prefix> . <service> . <stage> . <encoded-core-id>
     de.ard     . eventhub  .   dev   . urn%3Aard%3Aper...

=> de.ard.eventhub.dev.urn%3Aard%3Apermanent-livestream%3Aa315d3e482f09e1b
```

## Pub/Sub Subscriptions

```txt
<domain-prefix> . <service> . <module>     . <stage> .   <uid>
     de.ard     . eventhub  . subscription .   dev   . 9bdb9316-c78a-4ebe-a131-30b2738435a3

=> de.ard.eventhub.subscription.dev.9bdb9316-c78a-4ebe-a131-30b2738435a3
```
