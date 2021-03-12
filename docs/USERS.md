# ARD-Eventhub / Users

To authenticate and work with Eventhub API you will need a valid user. For now these user logins are kept separate from the ARD Core API, but are using a similar login method. This page covers the process of administrating users.  

- [ARD-Eventhub / Users](#ard-eventhub--users)
  - [Authentication](#authentication)
  - [Registering new users](#registering-new-users)

## Authentication

Please see the [Authentication document](AUTHENTICATION.md) to learn more about this process.

## Registering new users

New users cannot sign up themselves, but need to go through the ARD Online team to receive access to this service. The following step-by-step guide is targeted at admins, that want to add a new account for a user.  

- Open Datastore in the GCP Eventhub project, go to the appropriate namespace (usually `prod`) and kind `users`
- Check that the user really hasn't been registered, then add a new entity
  - The entity key needs to be '_Custom Name_', with the user's email address (in lowercase)
  - Set `active` to `true`
  - In the `institution` field, you will need to add an object with `name` and `id`. You can use this template and fill in the name and id strings. Make sure that `name` does not contain any special characters.  

```json
{
  "properties": {
    "name": {
      "stringValue": "name-here"
    },
    "id": {
      "stringValue": "urn:id-here"
    }
  }
}
```

- For `serviceIds` enter an array of all the services, that the user is allowed to publish to (as strings). Only enter the ids needed for publishing, there are no requirements for subscribing!

```json
{
  "values": [
    {
      "stringValue": "123456"
    },
    {
      "stringValue": "789012"
    }
  ]
}
```

- Now that the user is entered in Datastore with its profile, you can register it in Firebase. Therefore go to the [Firebase Console](https://console.firebase.google.com/) in the section _Build_ -> _Authentication_.  
  - On this page, click on _Add user_ and enter the same email address (again in lowercase). The password can be something random, that will never be seen.
  - Once the user has been added, click on the dropdown menu and select _Reset password_ and confirm the pop-up.
- The user will now receive an email to set their password, that they can then use to interact with the API.  

## Removing users

If a user needs to be removed from this service, do the following steps:

- Check if there are open subscriptions that they created, that might need to be removed (both in Pub/Sub and Datastore)
  - Note that subcription permissions are given institution-wide, so even if one user gets removed, their colleagues would still be able to modify these entries.
- Next, remove the user from Datastore by selecting and deleting their entry.
- Then also remove their profile from Firebase Console.
