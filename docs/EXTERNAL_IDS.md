# Wichtigkeit von External IDs

Damit der Eventhub zuverlässig arbeitet, muss ein Dienst eindeutig identifizierbar sein. Dies geschieht über das Feld `externalId` in der neuen ARD Core API. Evtl. kennst du bereits dieses Feld schon als _CRID_, welche in der TVA-Dokumentation verwendet wird.

⚠️  Bitte verwende **genau** die `externalId`, mit der du die Metadaten deiner Livestreams an ARD Core (_PermanentLivestream_) übermittelst. Bei Unsicherheit wende dich an deinen Metadaten-Ansprechpartner oder an das SWR Audio Lab.

> **Anforderungen und Empfehlungen für External IDs**
> Das externalId-Feld kann beim Erstellen einer Entität übergeben werden.>
> Falls du noch nicht über TVA lieferst, steht dir bei der Wahl der External ID grundsätzlich Freiheit zu. Deine Wahl **muss** jedoch folgende Kriterien erfüllen:
>
> (a) Die External ID einer einzelnen Entität darf sich nicht ändern
> (b) Die External ID bezieht sich auf die lokale Entität, die du importieren möchtest
> (c) Die External ID ist in Ihrem lokalen Kontext eindeutig
> (d) Die External ID ist im gesamten ARD-Kontext eindeutig

[Quelle: developer.ard.de](https://developer.ard.de/core-api-v2-delivering-content#ExternalIDRequirementsRecommendations)
