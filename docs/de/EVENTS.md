# ARD Eventhub / Events

In seiner ersten Version erwartet ARD Eventhub, dass der Wert `event` einer der folgenden Werte ist:

## `de.ard.eventhub.v1.radio.track.playing`

Dieses Ereignis markiert den Beginn eines neuen Spielelements/Tracks für den bereitstellenden Radiosender. Es sollte die `start` Zeitangabe der Quellinformation enthalten, um eine möglichst genaue Startzeit anzugeben und Abweichungen aufgrund von Netzwerklatenzen zu vermeiden.

## `de.ard.eventhub.v1.radio.track.next`

Das `next` Event hat Ähnlichkeiten zum `playing`Event aber kennzeichnet lediglich nur den planmäßig nächsten Titel. Das `next` Element kann durch ein neues `next` Element vor einem `playing` Element ersetzt werden, um einen neuen geplanten Titel zu kennzeichnen.

Ein Paar aus `next` und `playing` Events sollte eine Referenz zueinander haben (`playlistId`), damit Abonnenten diese beiden eingehenden Events miteinander verknüpfen können.

## `de.ard.eventhub.v1.radio.text`

Dieses Event legt den Live-Encoder-Text fest.
