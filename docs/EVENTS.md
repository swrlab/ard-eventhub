# ARD Eventhub / Events

In its first version ARD Eventhub expects the `event` value to be one of the following:

## `de.ard.eventhub.v1.radio.track.playing`

This event marks the beginning of a new playing element/ track for the providing radio station. It should have the `start` time information of the source information, to provide an as detailed as possible start time and avoid misalignments during network latencies.

## `de.ard.eventhub.v1.radio.track.next`

The `next` event is similar to `playing` but only signalizes the next scheduled upcoming track. The next element can be replaced by a new next element before a playing element to signalize a new scheduled track.
A pair of next and playing events should have a reference between each other (`playlistId`), so subscribers can link these two incoming events.
