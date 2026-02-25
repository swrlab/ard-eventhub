# ARD Eventhub / Authentifizierung
Auf dieser Seite wird der Prozess der Benutzerverwaltung beschrieben.

Um mit der Eventhub-API zu arbeiten (sich bei ihr zu authentifizieren), benötigst du einen gültigen Benutzer. Derzeit werden diese Benutzer getrennt von der ARD Core API verwaltet, verwenden jedoch eine ähnliche Anmeldemethode.

## Logindaten gegen Token austauschen

**POST `{HOST}/auth/login`**

```json
{
  "email": "my-email@example.com",
  "password": "my-password"
}
```

Ergibt `200 OK`

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

Dieser Endpunkt gibt einen `token` und einen `refreshToken` zusammen mit einer Ablaufdauer und einem Datum zurück. Der `token` kann innerhalb des zurückgegebenen Zeitraums verwendet werden.

## Refresh Token

Wenn der normale `token` abläuft, kannst du den `refreshToken` verwenden, um einen neuen `token` zu erhalten.

**POST `{HOST}/auth/refresh`**

```json
{
  "refreshToken": "abcXYZ..."
}
```

Ergibt `200 OK`

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

### Verfall der Refresh Token

Refresh Tokens verfallen nur, wenn einer der folgenden Fälle eintritt:

- Der Benutzer gelöscht wird
- Der Benutzer deaktiviert wird
- Für den Benutzer wurde eine wesentliche Änderung festgestellt. Dazu gehören Änderungen wie die Aktualisierung des Passworts oder der E-Mail-Adresse.

[Quelle: Firebase docs](https://firebase.google.com/docs/auth/admin/manage-sessions)

## Passwort Reset

Falls du dein Passwort verloren hast, kannst du über diesen Endpoint eine Passwort-Reset-E-Mail anfordern. Dieser Endpoint kann künftig einer Drosselung/Rate-Limitierung unterliegen.

**POST `{HOST}/auth/reset`**

```json
{
  "email": "my-email@example.com"
}
```

Ergibt `200 OK`
