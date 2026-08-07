---
title: "Radioplayer"
description: "Verwendung des Radioplayer Plugins im Eventhub."
---

Das Radioplayer-Plugin sendet Now-Playing-Metadaten (aktuell spielende Titel) an die Radioplayer-Plattform (https://play.radioplayer.org). Es verarbeitet ausschließlich Musik-Events (`type: music`) vom Typ `de.ard.eventhub.v1.radio.track.playing`.

## Radioplayer Opt-out

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

## Radioplayer Cover

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

```jsonc
{
  "type": "music",
  // ...
  "plugins": [
    {
      "type": "radioplayer",
      "isDeactivated": false,
      "preferArtistMedia": true,
    },
  ],
}
```

## Radioplayer UID Mapping

Die Zuordnung von ARD Core-IDs zu Radioplayer-Station-IDs (RP UID) erfolgt über die Mapping-Datei [`config/radioplayer-mapping.json5`](https://github.com/swrlab/ard-eventhub/blob/main/config/radioplayer-mapping.json5). Dort sind die gültigen URNs mit ihren entsprechenden Radioplayer-IDs hinterlegt. Um einen Livestream zu deaktivieren, setzt man den Wert auf `false`.

**ID-Mapping prüfen:** Zur Kontrolle oder Ergänzung der Zuordnung können folgende Quellen genutzt werden:

- [`config/radioplayer-mapping.json5`](https://github.com/swrlab/ard-eventhub/blob/main/config/radioplayer-mapping.json5) – lokale Mapping-Datei im Projekt
- [my.radioplayer.org/stations](https://www.my.radioplayer.org/stations) – Übersicht aller Radioplayer-Stationen und deren IDs
