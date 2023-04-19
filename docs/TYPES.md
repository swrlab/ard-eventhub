# ARD-Eventhub / Types

Each triggered `track` can and must be of a certain type, to be properly displayed by receiving subscribers.

- [ARD-Eventhub / Types](#ard-eventhub--types)
  - [`music`](#music)
  - [`live`](#live)
  - [`news`](#news)
  - [`weather`](#weather)
  - [`traffic`](#traffic)
  - [`audio`](#audio)
  - [`commercial`](#commercial)
  - [`jingle`](#jingle)

## `music`

A song or commercially produced piece of music. It is highly recommended and expected to set both `title` and `artist`. Full details about participating artists inside `contributors` is a bonus. This type should ideally also include references to its source element, like `confId` from ARD's HFDB, `isrc` and `upc`.

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

If a live element is starting. This can be an moderation by an anchor, interview or other live pieces. Use the `title` field to provide a comprehensive and publicly displayable short description.

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

## `news`

This indicates the beginning of the news in general or a new news item. Get as detailed as possible. The `contributors` field should be used to include details of the `author`. `media` may be used to supply additional elements. `show` references the correspoding broadcast series / grouping.

```json
{
  "event": "de.ard.eventhub.v1.radio.track.playing",
  "type": "news",
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

## `weather`

Similar to `news` it marks the beginning of a weather segment.

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

Similar to `news` and `weather` it can mark the beginning of a traffic announcement.

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

## `audio`

This type is the least descriptive and should only be used for pre-recorded elements that don't fit any of the other categories.

## `commercial`

Use this to provide triggers for playing commercials, such as ad breaks before the news. Doesn't need to be segmented or detailed in the `title` field.

## `jingle`

Unfavorable but can be used to signalize a new item that ends the previous element. Should only be used if no information about its contents are available. E.g. a jingle that starts the news, should not be sent as `jingle`, but as `news`. The `title` field must be a value that can be displayed externally and must not be the jingle's filename.
