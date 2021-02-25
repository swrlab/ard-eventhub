# ARD-Eventhub / Types

Each triggered `track` can and must be of a certain type, to be properly displayed by receiving subscribers.

## `audio`

This type is the least descriptive and should only be used for pre-recorded elements that don't fit any of the other categories.

## `commercial`

Use this to provide triggers for playing commercials, such as ad breaks before the news. Doesn't need to be segmented or detailed in the `title` field.

## `jingle`

Unfavorable but can be used to signalize a new item that ends the previous element. Should only be used if no information about its contents are available. E.g. a jingle that starts the news, should not be sent as `jingle`, but as `news`. The `title` field must be a value that can be displayed externally and must not be the jingle's filename.

## `live`

If a live element is starting. This can be an moderation by an anchor, interview or other live pieces. Use the `title` field to provide a comprehensive and publicly displayable short description.

## `music`

A song or commercially produced piece of music. It is highly recommended and expected to set both `title` and `artist`. Full details about participating artists inside `contributors` is a bonus. This type should ideally also include references to its source element, like `confId` from ARD's HFDB, `isrc` and `upc`.

## `news`

This indicates the beginning of the news in general or a new news item. Get as detailed as possible. The `contributors` field can be used to include details of the `author`. `media` may be used to supply additional elements.

## `traffic`

Similar to `news` and `weather` it can mark the beginning of a traffic announcement.

## `weather`

Similar to `news` it marks the beginning of a weather segment.
