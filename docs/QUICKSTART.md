# ARD-Eventhub / Quickstart

This guide will help you get started with ARD-Eventhub.  

No matter if you are a Publisher or Subscriber, you will need a user account to interact with the API. Request one through your contacts at SWR Audio Lab or ARD Online. Admins can reference the Users docs for account registrations.  

Once this has been set up, check the Authentication docs to learn more about the login and token exchange process.

## Publishers

If you are a radio station that wants to start publishing events to ARD-Eventhub, follow these easy steps:  

- Set up your account and understand the authentication process
- Use the POST `/events/{eventName}` endpoint to add your events
  - Note: Even if GET `/topics` does not list your radio station(s) beforehand, the topic(s) will be created during your first published event

Security Note: Every user account has a list of permitted `serviceIds` that they can publish to. If you are receiving an error, the Id could be misspelled, or the user account was wrongly configured by an admin.  

## Subscribers

If you plan to receive events published by other stations, add yourself as one of their subscribers and receive real-time POST webhooks for all published events. Those can then be used to improve your products such as websites and apps during rebroadcasts in the nightly tracks.  

Please be aware that the type of events published to this service may be extended in the future. Make sure to filter them appropriately. The data format should and will always be backwards-compatible, but new fields may be added to this service as needed.  

In case of nightly rebroadcasts you should create a permanent subscription and keep this one running 24/7. The filter based on the program schedule should be done on your side. Pub/Sub should not be used to create and delete subscriptions once the rebroadcast starts and ends.  

Start receiving events with these steps:  

- Set up your account and understand the authentication process
- Use the GET `/topics` endpoint to see a list of available channels (topics) that you can subscribe to
  - If a channel is not yet visible, no one has attempted to publish an event to it before. Topics are not created until someone starts publishing
- Use the POST `/subscriptions` endpoint to create your own subscription.
  - Check the Google Cloud page ["Receiving messages using Push"](https://cloud.google.com/pubsub/docs/push#receiving_messages) to learn more about the format that you will be receiving those events in
- Use GET `/subcriptions` to verify your new or existing subscriptions

Security Note: When a user is registered, it is linked to a specific institution (_Landesrundfunkanstalt_ or _GSEA_). Users can manage all subscriptions within this institution, so be careful not to delete your colleagues' (production) entries.  
With this method you will still have access to all subscriptions, even if a person leaves your institution or their account is deactivated.  
