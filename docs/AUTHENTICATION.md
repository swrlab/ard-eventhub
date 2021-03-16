# ARD-Eventhub / Authentication

To authenticate and work with Eventhub API you will need a valid user. For now these user logins are kept separate from the ARD Core API, but are using a similar login method. This page covers the authentication process.  

- [ARD-Eventhub / Authentication](#ard-eventhub--authentication)
  - [Authentication Overview](#authentication-overview)
  - [Exchange Credentials for Tokens](#exchange-credentials-for-tokens)
  - [Refresh Token](#refresh-token)
    - [Expiration](#expiration)
  - [Reset password](#reset-password)

## Authentication Overview

The app uses an authentication workflow, that is kept very similar to the new ARD Core API, so once it goes live there, it can be easily migrated (variations may apply). You can find their documentation for ARD in the [developer portal](https://developer.ard.de/core-api-v2-roles-and-access-control).  

This page explicitly covers the login methods for the ARD-Eventhub API. Compared to the ARD Core API the token exchange for ARD-Eventhub is handled in this service directly, not externally so it does not need to expose the `API_KEY` to clients.  

## Exchange Credentials for Tokens

**POST `{HOST}/auth/login`**

```json
{
  "email": "my-email@example.com",
  "password": "my-password"
}
```

Returns `200 OK`

```json
{
  "expiresIn": 3600,
  "expires": "2021-03-12T12:55:22.995Z",
  "token": "eyABCDEF.GHIJKL....",
  "refreshToken": "AOabcdefghijkl",
  "user": {
    "some": "objects"
  },
  "trace": null
}
```

This endpoint will return a `token` and `refreshToken` alongside an expiry duration and date. The `token` can be used immediately during the returned time frame.

## Refresh Token

While the normal `token` expires, the `refreshToken` can be used for a longer period of time. Therefore it can be used to be exchanged for a new `token`.  

**POST `{HOST}/auth/refresh`**

```json
{
  "refreshToken": "abcXYZ..."
}
```

Returns `200 OK`

```json
{
  "expiresIn": 3600,
  "expires": "2021-03-12T12:55:22.995Z",
  "token": "eyABCDEF.GHIJKL....",
  "refreshToken": "AOabcdefghijkl",
  "user": {
    "some": "objects"
  },
  "trace": null
}
```

### Expiration

> Refresh tokens expire only when one of the following occurs:
>
> - The user is deleted
> - The user is disabled
> - A major account change is detected for the user. This includes events like password or email address updates.  

[Source: Firebase docs](https://firebase.google.com/docs/auth/admin/manage-sessions)

## Reset password

Sometimes you might loose your old password and need to reset it. If this happens, use this endpoint to request a password reset email. This endpoint might be subject to throttling/ rate-limits in the future.  

**POST `{HOST}/auth/reset`**

```json
{
  "email": "my-email@example.com"
}
```

Returns `200 OK`
