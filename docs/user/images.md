---
title: 'Bilder'
description: 'Infos zu Covern und Bildern.'
sidebar:
  order: 10
  icon: image-up
---

## URLs

Bild-URLs müssen öffentlich erreichbar sein. Wer Bilder liefert, muss die Rechte zur Weitergabe besitzen. Bilder stehen im Array `media`. `type` ist `cover`, `artist` oder `anchor`.

`templateUrl` ist **deprecated**. Schick eine konkrete `url`. Ein Template mit `{width}` und `{height}` wird noch akzeptiert.

```json
{
	"type": "cover",
	"url": "https://example.com/cover.jpg",
	"description": "Cover Demo Artist",
	"attribution": "Photographer XYZ",
	"isFallback": false
}
```

```json
{
	"type": "artist",
	"url": "https://example.com/artist.jpg",
	"description": "Demo Artist",
	"attribution": "Photographer XYZ"
}
```

## Fallback-Bilder

Tracks ohne eigenes Cover (z. B. Verkehr oder Wetter) können Station- oder Platzhalterbilder mit `isFallback: true` mitschicken. Endclients können diese bei Bedarf herausfiltern.

```json
{
	"type": "cover",
	"url": "https://example.com/swr3-fallback.jpg",
	"description": "SWR3 Platzhalter",
	"isFallback": true
}
```

## Caching (ARD Sounds)

Cover für ARD Sounds werden vom ARD Play-out-Center gecacht, um die Client-Performance zu verbessern.
