# ARD-Eventhub / Quickstart

This guide will help you get started with ARD-Eventhub.

No matter if you are a Publisher or Subscriber, you will need a user account to interact with the API. Request one through your contacts at SWR Audio Lab or ARD Online. Admins can reference the Users docs for account registrations.

Once this has been set up, check the Authentication docs to learn more about the login and token exchange process.

- [ARD-Eventhub / Quickstart](#ard-eventhub--quickstart)
  - [Publishers](#publishers)
    - [Importance of External IDs](#importance-of-external-ids)
    - [Workflow Example](#workflow-example)
  - [Subscribers](#subscribers)
    - [Security](#security)
    - [Receiver Example](#receiver-example)

## Publishers

If you are a radio station that wants to start publishing events to ARD-Eventhub, follow these easy steps:

- Set up your account and understand the authentication process
- Use the POST `/events/{eventName}` endpoint to add your events
- Note: Even if GET `/topics` does not list your radio station(s) beforehand, the topic(s) will be created during your first published event (response will contain:

```js
{
    "statuses": {
        "published": 0,
        "blocked": 0,
        "failed": 1
    },
    "event": {
        "name": "de.ard.eventhub.v1.radio.track.next",
        // ...
        "services": [
            {
                "type": "PermanentLivestream",
                "externalId": "crid://swr.de/282310/demo7",
                "publisherId": "urn:ard:publisher:75dbb3dace15f610",
                "topic": {
                    "id": "urn:ard:permanent-livestream:234690e18c2c7863",
                    "name": "de.ard.eventhub.dev.urn%3Aard%3Apermanent-livestream%3A234690e18c2c7863",
                    "status": "TOPIC_CREATED",
                    "messageId": null
                }
            }
        ],
        // ...
    }
}
```

It is recommended to use the Eventhub `test` system first, to make sure everything works. Then bring it to production on `prod`. The host names are listed in the Stages document.

Security Note: Every user account can only publish to `publisherId`s from their own institution. If you are receiving an error, the Id could be misspelled, or the user account was wrongly configured by an admin.

### Importance of External IDs

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

### Workflow Example

In your system for every new event, you might follow a workflow like this:

1. Check if you have `token` from a previous call that has not expired
2. If not found, check if you have a `refreshToken` from a previous call
   1. If found exchange it for a new `token`
   2. If not found, create a new login
3. POST the event using the pre-defined format. The example below might help you understand the different fields:

```js
{
   "start": "2021-03-17T10:04:35+01:00",
   "length": 215.2,
   "title": "Save your tears",
   "artist": "The Weeknd",
   "contributors": [
      {
      "name": "The Weeknd",
      "role": "artist",
      "normDb": {
         "type": "Person",
         "id": "12345"
      }
      }
   ],
   "services": [
      {
         "type": "PermanentLivestream",
         "externalId": "crid://swr.de/282310",
         "publisherId": "282310"
      }
   ],
   "playlistItemId": "radiomax:SWR3-BAD-MAX:12569153",
   "externalId": "M0589810001",
   "isrc": null,
   "upc": null,
   "mpn": null,
   "media": [
      {
         "type": "cover",
         "url": "http://my-server/covers/M0589810.001",
         "templateUrl": null,
         "description": "SWR Cover zu Save your tears von The Weeknd",
         "attribution": ""
      }
   ],
   "type": "music",
   "hfdbIds": [
      "swrhfdb1.KONF.12345"
   ]
}

```

## Subscribers

If you plan to receive events published by other stations, add yourself as one of their subscribers and receive real-time POST webhooks for all published events. Those can then be used to improve your products such as websites and apps during re-broadcasts in the nightly tracks.

Please be aware that the type of events published to this service may be extended in the future. Make sure to filter them appropriately. The data format should and will always be backwards-compatible, but new fields may be added to this service as needed.

In case of nightly re-broadcasts you should create a permanent subscription and keep this one running 24/7. The filter based on the program schedule should be done on your side. Pub/Sub should not be used to create and delete subscriptions once the re-broadcast starts and ends.

Start receiving events with these steps:

- Set up your account and understand the authentication process
- Use the GET `/topics` endpoint to see a list of available channels (topics) that you can subscribe to
- If a channel is not yet visible, no one has attempted to publish an event to it before. Topics are not created until someone starts publishing
- Use the POST `/subscriptions` endpoint to create your own subscription.
- Check the Google Cloud page ["Receiving messages using Push"](https://cloud.google.com/pubsub/docs/push#receiving_messages) to learn more about the format that you will be receiving those events in
- Use GET `/subcriptions` to verify your new or existing subscriptions

Security Note: When a user is registered, it is linked to a specific institution (_Landesrundfunkanstalt_ or _GSEA_). Users can manage all subscriptions within this institution, so be careful not to delete your colleagues' (production) entries.  
With this method you will still have access to all subscriptions, even if a person leaves your institution or their account is deactivated.

### Security

Generally it is recommended to keep your endpoints hidden from public indexes. To be absolutely sure that an event is actually being received from Eventhub, you can make use of the provided JWT token and service account.  
For every subscription that you create, the response will (amongst other metadata) also include a field about the used service account:

```js
{
   ...
   "serviceAccount": "somethin@something-else.iam.gserviceaccount.com",
   ...
}
```

Please note that for now the service account usually contains the same response. However, for future subscriptions, it might contain a different account. Configure your service to validate the appropriate account for each subscription.

### Receiver Example

In a simplified way, your receiver might look something like this (example for NodeJS with Express). The Google Cloud section ["Authentication and authorization by the push endpoint"](https://cloud.google.com/pubsub/docs/push#authentication_and_authorization_by_the_push_endpoint) also holds more information about this process.  

```js
// load node packages
const { OAuth2Client } = require('google-auth-library')
const authClient = new OAuth2Client()

// set received serviceAccount
const serviceAccountEmail = 'somethin@something-else.iam.gserviceaccount.com'

module.exports = async (req, res) => {
   try {
      // read token from header
      const bearer = req.header('Authorization')
      const [, idToken] = bearer.match(/Bearer (.*)/)

      // verify token, throws error if invalid
      const verification = await authClient.verifyIdToken({
         idToken,
      })

      // check token email vs. subscription email
      if(verification?.payload?.email === serviceAccountEmail) {
         // get message and metadata from pubsub body
         const { attributes, messageId } = req.body.message
         const { subscription } = req.body
         let data = Buffer.from(req.body.message.data, 'base64').toString()
         data = JSON.parse(data)

         // request successful, you can now use the received data
         console.log({ attributes, messageId, subscription, data })

         // close connection
         return res.sendStatus(201)
      } else {
         // user provided valid token but failed email verification
         return res.sendStatus(204)
      }
   } catch (err) {
      // request failed or invalid token
      return res.sendStatus(204)
   }
}
```
