# ARD Eventhub / Types

Jeder ausgelöste `track` muss einem bestimmten Typ entsprechen, damit er von empfangenden Subscribern korrekt dargestellt werden kann.

## `music`

Ein Song oder kommerziell produziertes Musikstück. Es wird dringend empfohlen, mindestens `title` und `artist` zu setzen. Angaben zu beteiligten Künstlern im Feld `contributors` sind nützlich. Ideal sind außerdem Verweise auf Quell-IDs wie `confId` aus ARD's HFDB, `isrc` und `upc`.

```json
{
  "event": "de.ard.eventhub.v1.radio.track.playing",
  "type": "music",
  "start": "2020-01-19T06:00:00+01:00",
  "length": 240,
  "title": "Song name",
  "artist": "Sam Feldt feat. Someone Else",
  "contributors": [
    {
      "name": "Sam Feldt",
      "role": "artist",
      "normDb": {"type": "Person", "id": "1641010"},
      "isni": "string",
      "url": "string"
    }
  ],
  "playlistItemId": "swr3-5678",
  "hfdbIds": ["swrhfdb1.KONF.12345", "zskhfdb1.KONF.12345"],
  "externalId": "M012345.001",
  "isrc": "DE012345678",
  "upc": "string",
  "mpn": "string",
  "media": [
    {
      "type": "cover",
      "url": "https://example.com/cover.jpg",
      "templateUrl": "https://example.com/cover.jpg?width={width}",
      "description": "Cover Demo Artist",
      "attribution": "Photographer XYZ"
    }
  ],
  …
}
```

## `live`

Wenn ein Live-Element beginnt, z.B. Moderation, Interview oder andere Live-Beiträge. Verwenden Sie das Feld `title` für eine kurze, öffentlich darstellbare Beschreibung.

```json
{
  "event": "de.ard.eventhub.v1.radio.track.playing",
  "type": "live",
  "start": "2020-01-19T06:20:00+01:00",
  "length": 240,
  "title": "Moderation",
  …
}
```

## `audio`

Wird für Beiträge (pre-recorded) verwendet, die in keine andere Kategorie passen. So detailliert wie möglich ausfüllen. 
Das Feld `contributors` sollte Informationen zum `author` enthalten. `media` kann benutzt werden um zusätzliche Informationen zu liefern. `show` verweist auf die zugehörige Sendereihe.

```json
{
  "event": "de.ard.eventhub.v1.radio.track.playing",
  "type": "audio",
  "start": "2021-03-17T11:10:31+01:00",
  "length": 1415,
  "title": "Kommerzielle-Raumfahrt - eine Zukunftsvision?",
  "contributors": [
    {
      "role": "author",
      "name": "Arthur Landwehr",
      "normDb": {"type": "Person", "id": "212083"},
      "url": "https://www.br.de/nachrichten/autoren/arthur-landwehr,1e00eef2-ccc3-4250-9611-13436160c8b5"
    }
  ],
  "playlistItemId": "BCS1:cd052498-da90-4308-85d3-046cb15c6840",
  "externalId": "crid://swr.de/av/406d20f0-d9b8-431f-9e36-e2fa2cf263a5",
  "references": [
    {
      "type": "Show",
      "externalId": "crid://swr.de/1234567",
      "alternateIds": ["https://normdb.ivz.cn.ard.de/sendereihe/427", "urn:ard:show:027708befb6bfe14", "brid://br.de/broadcastSeries/1235"]
    },
    {
      "type": "Article",
      "title": "Kommerzielle US-Raumfahrt - Die neue Weltraumökonomie",
      "url": "https://www.deutschlandfunkkultur.de/kommerzielle-us-raumfahrt-die-neue-weltraumoekonomie-100.html"
    }
  ]
  …
}
```

## `news`

Dies kennzeichnet den Beginn der Nachrichten im Allgemeinen.

```json
{
  "event": "de.ard.eventhub.v1.radio.track.playing",
  "type": "news",
  "start": "2020-01-19T06:00:00+01:00",
  "length": 250,
  "title": "Nachrichten",
  "playlistItemId": "BCS1:cd052498-da90-4308-85d3-046cb15c6832",
  "references": [
    {
      "type": "Overview",
      "title": "BR Nachrichten",
      "url": "https://www.br.de/nachrichten/meldungen"
    }
  ]
  …
}
```

## `weather`

Ähnlich wie `news` markiert es den Beginn eines Wetterberichts.

```json
{
  "event": "de.ard.eventhub.v1.radio.track.playing",
  "type": "weather",
  "start": "2020-01-19T06:03:00+01:00",
  "length": 30,
  "title": "Wetter",
  …
}
```

## `traffic`

Ähnlich wie `news` and `weather` markiert es den Beginn eines Verkehrberichts.

```json
{
  "event": "de.ard.eventhub.v1.radio.track.playing",
  "type": "traffic",
  "start": "2020-01-19T06:03:30+01:00",
  "length": 10,
  "title": "Verkehr",
  …
}
```

## `commercial`

Verwenden Sie diese Option, um Auslöser für die Wiedergabe von Werbespots festzulegen, z. B. Werbepausen vor den Nachrichten. Eine Segmentierung oder detaillierte Angaben im Feld `title` sind nicht erforderlich.

## `jingle`

Ungünstig, kann jedoch verwendet werden, um einen neues Event zu signalisieren, der das vorherige Element beendet. Sollte nur verwendet werden, wenn keine Informationen über den Inhalt verfügbar ist. Beispielsweise sollte ein Jingle, der die Nachrichten einleitet, nicht als `jingle`, sondern als `news` gesendet werden. Das Feld `title` muss einen Wert enthalten, der extern angezeigt werden kann, und darf nicht der Dateiname des Jingles sein.

## `radio text`

Dieser Typ wird verwendet, um den Live-Encoder-Text festzulegen.

```json
{
  "event": "de.ard.eventhub.v1.radio.text",
  "start": "2020-01-19T06:00:00+01:00",
  "validUntil": "2026-01-19T06:00:00+01:00",
  "text": "Catchy one Liner",
  …
}
```
