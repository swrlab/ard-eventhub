# Common IDs

## Nightly National Broadcasts

Some broadcasters are responsible for providing shared nightly national broadcasts. As you may need the corresponding metadata for your own broadcasts, you can use the following IDs to identify them. These are dedicated topics for just the nightly broadcast data.

| Broadcast               | Publisher  | Core ID                                         | Nightly-only topic? |
| ----------------------- | ---------- | ----------------------------------------------- | ------------------- |
| ARD Hitnacht            | MDR        | `urn:ard:event-livestream:22da95c49a047225`     | true                |
| ARD Infonacht           | NDR Info   | n/a                                             | n/a                 |
| ARD Popnacht            | SWR3       | `urn:ard:permanent-livestream:885aa9c84e5374bd` | true                |
| Die Junge Nacht der ARD | WDR/ 1LIVE | `urn:ard:permanent-livestream:d22e908de85bfd44` | true                |

## Common/ Firehose Topic

Each stage of the Eventhub has some common topics that are used to deliver all events. These are the so-called "firehose" topics.

They are split between event types; therefore, you could subscribe to either `v1.radio.track.playing` or `v1.radio.track.next`. Please note that due to the high volume of likely irrelevant events for you, you should preferably use a subscription to the topic of an individual livestream.

## Other IDs

All other IDs for livestreams can be found in the API (`GET /topics`).
