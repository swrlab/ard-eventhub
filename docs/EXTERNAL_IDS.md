# Importance of External IDs

For the Eventhub to work it needs to be able to uniquely identify a service. This is defined as the so-called `externalId` in ARD's new Core API. You might currently know this as _CRID_, which you are using in the TVA documents.

⚠️ Please make sure to use the **exact** `externalId` that you will be using to deliver the metadata of your livestreams to ARD Core (_PermanentLivestream_). When in doubt please reach out to your metadata contacts or to SWR Audio Lab.

> **External ID Requirements and Recommendations**
> The external ID may be provided through the field `externalId` during an entity creation request.
>
> If you do not already deliver content via TVA you are free in your choice of external ID. However, your choice **must** meet the following criteria:
>
> (a) The external ID of a single entity does not change over time
> (b) The external ID is referring to the local entity you want to import
> (c) The external ID is unique in your own local context
> (d) The external ID is unique in the whole ARD context

[Source: developer.ard.de](https://developer.ard.de/core-api-v2-delivering-content#ExternalIDRequirementsRecommendations)
