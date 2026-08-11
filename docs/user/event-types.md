---
title: 'Event-Types'
description: 'Unterstützte Optionen im ARD Eventhub.'
---

Zurzeit erwartet ARD Eventhub, dass der Wert `event` einer der folgenden Werte ist (Änderungen möglich):

## `de.ard.eventhub.v1.radio.track.playing`

Dieses Ereignis markiert den Beginn eines neuen Elementes/ Tracks für den jeweiligen Radiosender. Es sollte die `start` Zeitangabe der Quellinformation enthalten, um eine möglichst genaue Startzeit anzugeben und Abweichungen aufgrund von Netzwerklatenzen zu vermeiden.

`length` muss mit der geschätzten Dauer des Elements in Sekunden gesetzt werden und darf weder `0` noch `null` sein. Das Ende des aktuellen Elements ergibt sich aus dem `start` des folgenden Elements — nicht aus `start + length`.

## `de.ard.eventhub.v1.radio.track.next`

Das `next` Event hat Ähnlichkeiten zum `playing`Event aber kennzeichnet lediglich nur den planmäßig nächsten Titel. Das `next` Element kann durch ein neues `next` Element vor einem `playing` Element ersetzt werden, um einen neuen geplanten Titel zu kennzeichnen.

Ein Paar aus `next` und `playing` Events sollte eine Referenz zueinander haben (`playlistId`), damit Abonnenten diese beiden eingehenden Events miteinander verknüpfen können.
