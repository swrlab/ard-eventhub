# ARD Eventhub / Plugins

Der Eventhub ermöglicht die Integration verschiedener Plugins. Diese werden dafür verwendet Daten zu verarbeiten und zu transformieren und sie dann an die jeweils vorgesehenen Ziele zu senden. Diese Seite gibt einen Überblick über die aktuell verfügbaren Plugins.

## DTS Xperi

Dieses Plugin ermöglicht das Übermitteln von Metadaten an das DTS-System. Aktuell ist es als Opt-out-Feature konfiguriert — die Übermittlung erfolgt also standardmäßig. Das Opt-out gilt derzeit nur für Musiktitel (`type: music`). Das Senden kann für jedes einzelne Event überschrieben werden, sofern man es selber setzen möchte:

```js
{
  type: 'music',
  // ...
  plugins: [
    {
      type: 'dts',
      isDeactivated: false,
    },
  ],
}
```

Folgende Optionen können gesetzt werden:

- `isDeactivated` (boolean, Standard `false`) - bei `true` werden keine Daten an das externe System gesendet
- `delay` (int, Standard `0`) - Verzögerung, die gewartet wird, bis die Daten angezeigt werden
- `album` (string, Standard `null`) - Albumtitel, falls vorhanden
- `composer` (string, Standard `null`) - Komponist, falls vorhanden
- `program` (string, Standard `null`) - Programmtitel, falls vorhanden
- `subject` (string, Standard `null`) - Thema, falls vorhanden
- `webUrl` (string, Standard `null`) - URL zur Webseite des Events
- `preferArtistMedia` (boolean, Standard `false`) - bei `true` wird Medienmaterial des Künstlers dem Cover vorgezogen
- `excludeFields` (array, Standard `[]`) - Felder, die vom Versand an das externe System ausgeschlossen werden

Wenn `plugins[].type === 'dts'` nicht gesetzt ist, wird es automatisch hinzugefügt (Opt-out-Prinzip). Das `isDeactivated` Feld ist optional und standardmäßig auf `false` gesetzt. Setzt man es auf `true`, werden die Daten nicht gesendet.

ARD Core IDs sind im externen System bereits gemappt. Änderungen an Ihren IDs (nicht empfohlen) erfordern manuelle Anpassungen — wenden Sie sich bei Bedarf an die zuständigen Stellen.

## Radioplayer

Das Radioplayer-Plugin sendet Now-Playing-Metadaten (aktuell spielende Titel) an die Radioplayer-Plattform. Es verarbeitet ausschließlich Musik-Events (`type: music`) vom Typ `de.ard.eventhub.v1.radio.track.playing`.

### Radioplayer Opt-out

Das Plugin kann wie folgt deaktiviert werden (opt-out-Prinzip):

```js
{
  type: 'music',
  // ...
  plugins: [
    {
      type: 'radioplayer',
      isDeactivated: true,
    },
  ],
}
```

### Radioplayer Cover

Wird eine Übertragung von möglicherweise verfügbaren Covern nicht gewünscht, kann das Plugin wie folgt konfiguriert werden:

```js
{
  type: 'music',
  // ...
  plugins: [
    {
      type: 'radioplayer',
      isDeactivated: false,
      excludeFields: ['imageUrl'],
    },
  ],
}
```

Standardmäßig wird das Medien-Element von `type: 'cover'` verwendet. Soll das Medien-Element von `type: 'artist'` (Künstlerbilder) verwendet werden, kann das Plugin wie folgt konfiguriert werden:

```js
{
  type: 'music',
  // ...
  plugins: [
    {
      type: 'radioplayer',
      isDeactivated: false,
      preferArtistMedia: true,
    },
  ],
}
```

### Radioplayer UID Mapping

Die Zuordnung von ARD Core-IDs zu Radioplayer-Station-IDs (RP UID) erfolgt über die Mapping-Datei [`config/radioplayer-mapping.json5`](https://github.com/swrlab/ard-eventhub/blob/main/config/radioplayer-mapping.json5). Dort sind die gültigen URNs mit ihren entsprechenden Radioplayer-IDs hinterlegt. Um einen Livestream zu deaktivieren, setzt man den Wert auf `false`.

**ID-Mapping prüfen:** Zur Kontrolle oder Ergänzung der Zuordnung können folgende Quellen genutzt werden:

- [`config/radioplayer-mapping.json5`](https://github.com/swrlab/ard-eventhub/blob/main/config/radioplayer-mapping.json5) – lokale Mapping-Datei im Projekt
- [my.radioplayer.org/stations](https://www.my.radioplayer.org/stations) – Übersicht aller Radioplayer-Stationen und deren IDs

## Weitere Plugins

Obwohl es endlose Möglichkeiten für weitere Plugins gibt, gibt es jedoch Richtlinien, die eingehalten werden müssen. Wende dich für Details an das ARD Partnermanagement Audio & Voice.
