# Wichtigkeit von External IDs

Damit der Eventhub zuverlässig arbeitet, muss ein Dienst eindeutig identifizierbar sein. Dies geschieht über das Feld `externalId` in der neuen ARD Core API. Möglicherweise kennen Sie dies derzeit als _CRID_, welche in der TVA-Dokumentation verwendet wird.

⚠️  Bitte verwenden Sie **genau** die `externalId`, mit der Sie die Metadaten Ihrer Livestreams an ARD Core (_PermanentLivestream_) übermitteln. Bei Unsicherheit wenden Sie sich an Ihre Metadaten-Ansprechpartner oder an das SWR Audio Lab.

> **Anforderungen und Empfehlungen für External IDs**
> Das externalId-Feld kann beim Erstellen einer Entität übergeben werden.>
> Falls Sie noch nicht über TVA liefern, steht Ihnen bei der Wahl der External ID grundsätzlich Freiheit zu. Ihre Wahl **muss** jedoch folgende Kriterien erfüllen:
> 
> (a) Die External ID einer einzelnen Entität darf sich nicht ändern
> (b) Die External ID bezieht sich auf die lokale Entität, die Sie importieren möchten
> (c) Die External ID ist in Ihrem lokalen Kontext eindeutig
> (d) Die External ID ist im gesamten ARD-Kontext eindeutig

[Source: developer.ard.de](https://developer.ard.de/core-api-v2-delivering-content#ExternalIDRequirementsRecommendations)
